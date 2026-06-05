// CSKH / Lễ tân patient intake. RLS on `patient` only has a SELECT policy, so
// authenticated INSERTs are denied — we write with the service-role client.
// Access control = shared session + an intake role cookie (CSKH/RECEPTION/MGMT).
//
//   POST { full_name, date_of_birth?, phone_primary?, phone_secondary?,
//          national_id_number?, location_id, force? }
//     → { duplicate: true, matches: [...] }   when phone already exists & !force
//     → { ok: true, patient: {...} }          on insert

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getSupabaseService } from "../../../lib/supabase-service";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { canWriteIntake, canEditPatient } from "../../../lib/roles";
import { PHONE_RE, CCCD_RE } from "../../../lib/validation";
import { logEvent } from "../../../lib/event-log";

interface Body {
  full_name?: string;
  date_of_birth?: string;
  // Năm sinh khi BN chỉ nhớ năm (feedback B5#4). Cần migration 040; nếu chưa
  // apply, insert dưới bắt lỗi cột thiếu → bỏ birth_year, giữ date_of_birth.
  birth_year?: number | string;
  phone_primary?: string;
  phone_secondary?: string;
  national_id_number?: string;
  location_id?: string;
  // Hành chính (mục I form khám) — đồng bộ sang hồ sơ lâm sàng.
  gender?: string;
  ethnicity?: string;
  nationality?: string;
  occupation?: string;
  patient_objection?: string;
  address?: string;
  guardian_name?: string;
  force?: boolean;
}

/** Trim → null nếu rỗng. */
function nn(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

// Mã BN tạm: BN-<năm>-<6 số>. Thêm thành phần ngẫu nhiên + lệch theo lần thử để
// giảm đụng UNIQUE khi nhiều người tạo cùng lúc (loop retry ở dưới).
function patientCode(attempt: number): string {
  const year = new Date().getFullYear();
  const n =
    (Date.now() + attempt * 7919 + Math.floor(Math.random() * 100_000)) %
    1_000_000;
  return `BN-${year}-${String(n).padStart(6, "0")}`;
}

export async function POST(request: Request) {
  // Must hold the shared session AND an intake role.
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = await getClinicRole();
  if (!canWriteIntake(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staffId = await getClinicStaffId();

  const db = getSupabaseService();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa cấu hình trên server." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const full_name = (body.full_name ?? "").trim();
  const location_id = (body.location_id ?? "").trim();
  const phone_primary = (body.phone_primary ?? "").trim() || null;
  if (!full_name) {
    return NextResponse.json({ error: "Phải nhập họ tên." }, { status: 400 });
  }
  if (!location_id) {
    return NextResponse.json({ error: "Phải chọn cơ sở." }, { status: 400 });
  }

  // Quy tắc nhập liệu CỨNG (server-side, không tin client): SĐT 10 số / CCCD 12 số.
  const phone_secondary = (body.phone_secondary ?? "").trim() || null;
  if (phone_primary && !PHONE_RE.test(phone_primary)) {
    return NextResponse.json(
      { error: "SĐT chính phải gồm đúng 10 chữ số liền." },
      { status: 400 },
    );
  }
  if (phone_secondary && !PHONE_RE.test(phone_secondary)) {
    return NextResponse.json(
      { error: "SĐT người nhà phải gồm đúng 10 chữ số liền." },
      { status: 400 },
    );
  }

  // CCCD là UNIQUE cứng (không bỏ qua được kể cả force) → kiểm TRƯỚC để báo lỗi
  // rõ ràng thay vì rơi vào "không tạo được mã BN".
  const national = (body.national_id_number ?? "").trim() || null;
  if (national && !CCCD_RE.test(national)) {
    return NextResponse.json(
      { error: "CCCD phải gồm đúng 12 chữ số liền." },
      { status: 400 },
    );
  }
  if (national) {
    const { data: cccdDup } = await db
      .from("patient")
      .select("patient_code, full_name")
      .eq("national_id_number", national)
      .limit(1);
    if (cccdDup && cccdDup.length > 0) {
      return NextResponse.json(
        {
          error: `CCCD này đã có hồ sơ (${cccdDup[0].patient_code} · ${cccdDup[0].full_name}).`,
        },
        { status: 409 },
      );
    }
  }

  // Lightweight duplicate guard (not full MPI): same phone already on file.
  if (phone_primary && !body.force) {
    const { data: dupes } = await db
      .from("patient")
      .select("clinic_patient_id, patient_code, full_name, date_of_birth")
      .eq("phone_primary", phone_primary)
      .limit(5);
    if (dupes && dupes.length > 0) {
      return NextResponse.json({ duplicate: true, matches: dupes });
    }
  }

  // Năm sinh-only (feedback B5#4): nếu chỉ có năm → lưu birth_year + đặt
  // date_of_birth = YYYY-01-01 để tuổi + mọi chỗ hiển thị NGÀY vẫn chạy.
  const byNum = Number(body.birth_year);
  const byValid =
    body.birth_year != null &&
    String(body.birth_year).trim() !== "" &&
    Number.isFinite(byNum) &&
    byNum >= 1900 &&
    byNum <= 2100;
  const birthYear = byValid ? Math.trunc(byNum) : null;
  let dob = (body.date_of_birth ?? "").trim() || null;
  if (!dob && birthYear) dob = `${birthYear}-01-01`;

  const row: Record<string, unknown> = {
    full_name,
    date_of_birth: dob,
    phone_primary,
    phone_secondary,
    national_id_number: national,
    location_id,
    gender: nn(body.gender),
    ethnicity: nn(body.ethnicity),
    nationality: nn(body.nationality),
    occupation: nn(body.occupation),
    patient_objection: nn(body.patient_objection),
    address: nn(body.address),
    guardian_name: nn(body.guardian_name),
    is_active: true,
  };
  if (birthYear) row.birth_year = birthYear;

  // Insert with a generated patient_code; retry on the (rare) unique clash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("patient")
      .insert({ ...row, patient_code: patientCode(attempt) })
      .select("clinic_patient_id, full_name, patient_code")
      .single();
    if (!error) {
      // Append-only audit trail for this intake (best-effort, see event-log.ts).
      await logEvent(db, {
        event_type: "patient.created",
        aggregate_type: "patient",
        aggregate_id: data.clinic_patient_id,
        payload: {
          clinic_patient_id: data.clinic_patient_id,
          patient_code: data.patient_code,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth,
          phone_primary: row.phone_primary,
          phone_secondary: row.phone_secondary,
          national_id_number: row.national_id_number,
          location_id: row.location_id,
        },
        metadata: {
          clinic_role: role,
          clinic_staff_id: staffId,
          actor_auth_user_id: user.id,
          origin: "dashboard:patient-intake",
        },
      });
      return NextResponse.json({ ok: true, patient: data });
    }
    // 42703 = undefined_column: birth_year chưa tồn tại (migration 040 chưa
    // apply) → bỏ birth_year (date_of_birth = YYYY-01-01 vẫn lưu), thử lại.
    if (error.code === "42703" && "birth_year" in row) {
      delete row.birth_year;
      continue;
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // 23505 = unique_violation. Nếu là CCCD (race hiếm sau pre-check) → báo rõ,
    // KHÔNG retry (mã BN đổi cũng vô ích). Còn lại = clash patient_code → loop.
    if (/national_id|cccd/i.test(`${error.message} ${error.details ?? ""}`)) {
      return NextResponse.json(
        { error: "CCCD này vừa được tạo cho hồ sơ khác." },
        { status: 409 },
      );
    }
  }
  return NextResponse.json(
    { error: "Không tạo được mã BN, thử lại." },
    { status: 500 },
  );
}

// PATCH { clinic_patient_id, full_name?, date_of_birth?, phone_primary?,
//         phone_secondary?, location_id? } → cập nhật thông tin BN (CSKH/Lễ tân/QL).
// Không đụng national_id_number (D-identity). Ghi qua service-role.
interface PatchBody {
  clinic_patient_id?: string;
  full_name?: string;
  date_of_birth?: string;
  phone_primary?: string;
  phone_secondary?: string;
  location_id?: string;
  gender?: string;
  ethnicity?: string;
  nationality?: string;
  occupation?: string;
  patient_objection?: string;
  address?: string;
  guardian_name?: string;
}

export async function PATCH(request: Request) {
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = await getClinicRole();
  // SỬA hồ sơ hành chính: intake (CSKH/Lễ tân/QL/ĐD) + BÁC SĨ. (Tạo mới = POST
  // vẫn chỉ canWriteIntake — bác sĩ không tạo BN, chỉ sửa.)
  if (!canEditPatient(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.clinic_patient_id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Thiếu id bệnh nhân." }, { status: 400 });

  const full_name = (body.full_name ?? "").trim();
  if (!full_name) {
    return NextResponse.json({ error: "Phải nhập họ tên." }, { status: 400 });
  }
  // Quy tắc nhập liệu CỨNG (server-side): SĐT 10 số.
  const editPhone = (body.phone_primary ?? "").trim();
  const editPhone2 = (body.phone_secondary ?? "").trim();
  if (editPhone && !PHONE_RE.test(editPhone)) {
    return NextResponse.json(
      { error: "SĐT chính phải gồm đúng 10 chữ số liền." },
      { status: 400 },
    );
  }
  if (editPhone2 && !PHONE_RE.test(editPhone2)) {
    return NextResponse.json(
      { error: "SĐT người nhà phải gồm đúng 10 chữ số liền." },
      { status: 400 },
    );
  }

  const db = getSupabaseService();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa cấu hình trên server." },
      { status: 503 },
    );
  }

  const patch: Record<string, string | null> = {
    full_name,
    date_of_birth: (body.date_of_birth ?? "").trim() || null,
    phone_primary: (body.phone_primary ?? "").trim() || null,
    phone_secondary: (body.phone_secondary ?? "").trim() || null,
    gender: nn(body.gender),
    ethnicity: nn(body.ethnicity),
    nationality: nn(body.nationality),
    occupation: nn(body.occupation),
    patient_objection: nn(body.patient_objection),
    address: nn(body.address),
    guardian_name: nn(body.guardian_name),
  };
  const loc = (body.location_id ?? "").trim();
  if (loc) patch.location_id = loc;

  const { data, error } = await db
    .from("patient")
    .update(patch)
    .eq("clinic_patient_id", id)
    .select(
      "clinic_patient_id, full_name, date_of_birth, phone_primary, phone_secondary, location_id, gender, ethnicity, nationality, occupation, patient_objection, address, guardian_name",
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy bệnh nhân." }, { status: 404 });
  }

  await logEvent(db, {
    event_type: "patient.updated",
    aggregate_type: "patient",
    aggregate_id: id,
    payload: { clinic_patient_id: id },
    metadata: {
      clinic_role: role,
      actor_auth_user_id: user.id,
      origin: "dashboard:patient-edit",
    },
  });

  return NextResponse.json({ ok: true, patient: data });
}
