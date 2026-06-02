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
import { canWriteIntake } from "../../../lib/roles";
import { logEvent } from "../../../lib/event-log";

interface Body {
  full_name?: string;
  date_of_birth?: string;
  phone_primary?: string;
  phone_secondary?: string;
  national_id_number?: string;
  location_id?: string;
  force?: boolean;
}

function patientCode(): string {
  const year = new Date().getFullYear();
  const tail = String(Date.now() % 1_000_000).padStart(6, "0");
  return `BN-${year}-${tail}`;
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

  const row = {
    full_name,
    date_of_birth: (body.date_of_birth ?? "").trim() || null,
    phone_primary,
    phone_secondary: (body.phone_secondary ?? "").trim() || null,
    national_id_number: (body.national_id_number ?? "").trim() || null,
    location_id,
    is_active: true,
  };

  // Insert with a generated patient_code; retry once on the (rare) unique clash.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await db
      .from("patient")
      .insert({ ...row, patient_code: patientCode() })
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
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // 23505 = unique_violation on patient_code → loop to regenerate.
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
}

export async function PATCH(request: Request) {
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = await getClinicRole();
  if (!canWriteIntake(role)) {
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
  };
  const loc = (body.location_id ?? "").trim();
  if (loc) patch.location_id = loc;

  const { data, error } = await db
    .from("patient")
    .update(patch)
    .eq("clinic_patient_id", id)
    .select("clinic_patient_id, full_name, date_of_birth, phone_primary, phone_secondary, location_id")
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
