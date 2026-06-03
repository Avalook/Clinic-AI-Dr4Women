// Appointment booking for CSKH / Lễ tân. Same access model + service-role
// write path as /api/patients.
//
//   POST { clinic_patient_id, doctor_id?, service_type_id, location_id,
//          slot_start, slot_end, booking_channel? }
//     → { ok: true, appointment_id }
//
// The DB has an exclusion constraint (appointment_no_doctor_overlap) — a
// doctor double-book surfaces as a friendly 409.
//
//   PATCH { id, action: "confirm" | "decline" }   (DOCTOR only, own appt)
//     → { ok: true, status }
//   Confirm: SCHEDULED→CONFIRMED. Decline: SCHEDULED→DOCTOR_DECLINED (keeps
//   doctor_id so it stays in the doctor's history; reception is notified via
//   the declined-appointments query in the dashboard layout).

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getSupabaseService } from "../../../lib/supabase-service";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { canWriteIntake, isDoctorRole } from "../../../lib/roles";
import { logEvent } from "../../../lib/event-log";

interface Body {
  clinic_patient_id?: string;
  doctor_id?: string;
  service_type_id?: string;
  location_id?: string;
  slot_start?: string;
  slot_end?: string;
  booking_channel?: string;
}

export async function POST(request: Request) {
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

  const clinic_patient_id = (body.clinic_patient_id ?? "").trim();
  const service_type_id = (body.service_type_id ?? "").trim();
  const location_id = (body.location_id ?? "").trim();
  const slot_start = (body.slot_start ?? "").trim();
  const slot_end = (body.slot_end ?? "").trim();
  if (!clinic_patient_id || !service_type_id || !location_id) {
    return NextResponse.json(
      { error: "Thiếu bệnh nhân / dịch vụ / cơ sở." },
      { status: 400 },
    );
  }
  if (!slot_start || !slot_end) {
    return NextResponse.json({ error: "Thiếu giờ hẹn." }, { status: 400 });
  }
  if (new Date(slot_end).getTime() <= new Date(slot_start).getTime()) {
    return NextResponse.json(
      { error: "Giờ kết thúc phải sau giờ bắt đầu." },
      { status: 400 },
    );
  }

  const doctor_id = (body.doctor_id ?? "").trim() || null;
  const booking_channel = (body.booking_channel ?? "").trim() || "WALK_IN";

  const { data, error } = await db
    .from("appointment")
    .insert({
      clinic_patient_id,
      doctor_id,
      service_type_id,
      location_id,
      slot_start,
      slot_end,
      booking_channel,
      status: "SCHEDULED",
    })
    .select("id")
    .single();

  if (error) {
    // 23P01 = exclusion_violation (doctor slot overlap).
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "Bác sĩ đã có lịch trùng khung giờ này." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Append-only audit trail for this booking (best-effort, see event-log.ts).
  await logEvent(db, {
    event_type: "appointment.created",
    aggregate_type: "appointment",
    aggregate_id: data.id,
    payload: {
      appointment_id: data.id,
      clinic_patient_id,
      doctor_id,
      service_type_id,
      location_id,
      slot_start,
      slot_end,
      booking_channel,
      status: "SCHEDULED",
    },
    metadata: {
      clinic_role: role,
      clinic_staff_id: staffId,
      actor_auth_user_id: user.id,
      origin: "dashboard:appointment-booking",
    },
  });

  return NextResponse.json({ ok: true, appointment_id: data.id });
}

type PatchAction =
  | "confirm"
  | "decline"
  | "complete"
  | "checkin"
  | "undo_checkin"
  | "cskh_confirm";

interface PatchBody {
  id?: string;
  action?: PatchAction;
}

// "complete" = bác sĩ chốt KHÁM XONG (lịch → COMPLETED). KHÔNG đụng visit
// (FINALIZED là khóa pháp lý riêng, không tự quyết ở đây).
const DOCTOR_ACTIONS = new Set<PatchAction>(["confirm", "decline", "complete"]);
// Front-desk (Lễ tân/CSKH/Quản lý) actions.
const CHECKIN_ACTIONS = new Set<PatchAction>([
  "checkin",
  "undo_checkin",
  "cskh_confirm",
]);

export async function PATCH(request: Request) {
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  const action = body.action;
  if (!id || !action || (!DOCTOR_ACTIONS.has(action) && !CHECKIN_ACTIONS.has(action))) {
    return NextResponse.json(
      { error: "Thiếu id lịch hẹn hoặc action không hợp lệ." },
      { status: 400 },
    );
  }

  const role = await getClinicRole();
  const staffId = await getClinicStaffId();

  // Confirm / decline: DOCTOR, own appt. Check-in: front-desk (Lễ tân/CSKH/QL).
  if (DOCTOR_ACTIONS.has(action)) {
    if (!isDoctorRole(role)) {
      return NextResponse.json(
        { error: "Chỉ bác sĩ mới xác nhận/từ chối lịch hẹn." },
        { status: 403 },
      );
    }
    if (!staffId) {
      return NextResponse.json(
        { error: "Chưa chọn danh tính bác sĩ." },
        { status: 403 },
      );
    }
  } else if (!canWriteIntake(role)) {
    return NextResponse.json(
      { error: "Chỉ Lễ tân / CSKH / Quản lý mới check-in bệnh nhân." },
      { status: 403 },
    );
  }

  const db = getSupabaseService();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa cấu hình trên server." },
      { status: 503 },
    );
  }

  const { data: appt, error: loadErr } = await db
    .from("appointment")
    .select("id, doctor_id, status, clinic_patient_id, slot_start")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!appt) {
    return NextResponse.json({ error: "Không tìm thấy lịch hẹn." }, { status: 404 });
  }

  // Resolve the transition + the status it must currently be in (race guard).
  let newStatus: string;
  let fromStatuses: string[];
  if (action === "confirm" || action === "decline" || action === "complete") {
    if (appt.doctor_id !== staffId) {
      return NextResponse.json(
        { error: "Lịch hẹn này không thuộc bác sĩ." },
        { status: 403 },
      );
    }
    if (action === "confirm") {
      newStatus = "CONFIRMED";
      fromStatuses = ["SCHEDULED"];
    } else if (action === "decline") {
      newStatus = "DOCTOR_DECLINED";
      fromStatuses = ["SCHEDULED"];
    } else {
      // Khám xong: đã xác nhận / đã đến → COMPLETED.
      newStatus = "COMPLETED";
      fromStatuses = ["CONFIRMED", "CHECKED_IN"];
    }
  } else if (action === "checkin") {
    newStatus = "CHECKED_IN";
    fromStatuses = ["SCHEDULED", "CONFIRMED"];
  } else if (action === "cskh_confirm") {
    // CSKH gọi xác nhận lịch với khách → SCHEDULED → CONFIRMED.
    newStatus = "CONFIRMED";
    fromStatuses = ["SCHEDULED"];
  } else {
    newStatus = "CONFIRMED";
    fromStatuses = ["CHECKED_IN"];
  }

  if (!fromStatuses.includes(appt.status)) {
    return NextResponse.json(
      { error: `Lịch hẹn đang ở trạng thái ${appt.status}, không thể thực hiện.` },
      { status: 409 },
    );
  }

  const { error: updErr } = await db
    .from("appointment")
    .update({ status: newStatus })
    .eq("id", id)
    .in("status", fromStatuses);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const eventType: Record<PatchAction, string> = {
    confirm: "appointment.confirmed",
    decline: "appointment.declined",
    complete: "appointment.completed",
    checkin: "appointment.checked_in",
    undo_checkin: "appointment.checkin_undone",
    cskh_confirm: "appointment.cskh_confirmed",
  };

  await logEvent(db, {
    event_type: eventType[action],
    aggregate_type: "appointment",
    aggregate_id: id,
    payload: {
      appointment_id: id,
      status: newStatus,
      doctor_id: appt.doctor_id,
      clinic_patient_id: appt.clinic_patient_id,
      slot_start: appt.slot_start,
    },
    metadata: {
      clinic_role: role,
      clinic_staff_id: staffId,
      actor_auth_user_id: user.id,
      origin: `dashboard:appointment-${action}`,
    },
  });

  // CSKH xác nhận lịch → GHI THẬT 1 việc "Đặt hẹn" vào cskh_action ngay (không
  // chờ Zalo/Pancake). Hiện luôn ở board "Theo dõi tình trạng lịch hẹn" cột Đặt
  // hẹn. Upsert theo source_ref để không trùng khi xác nhận lại. Best-effort:
  // lỗi ghi log này KHÔNG làm hỏng việc xác nhận lịch (đã thành công ở trên).
  if (action === "cskh_confirm") {
    const slot = appt.slot_start ? new Date(appt.slot_start as string) : null;
    const slotStr = slot
      ? slot.toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    await db.from("cskh_action").upsert(
      {
        source_ref: `dash-confirm-${id}`,
        clinic_patient_id: appt.clinic_patient_id,
        category: "Đặt hẹn",
        status: "Đã xác nhận lịch hẹn",
        description: `CSKH xác nhận lịch hẹn${slotStr ? ` · ${slotStr}` : ""}`,
        source_created_at: new Date().toISOString(),
        created_by_text: "CSKH · dashboard",
        appointment_link_raw: id,
      },
      { onConflict: "source_ref" },
    );
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
