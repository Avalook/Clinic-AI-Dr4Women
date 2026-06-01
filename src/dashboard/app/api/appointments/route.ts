// Appointment booking for CSKH / Lễ tân. Same access model + service-role
// write path as /api/patients.
//
//   POST { clinic_patient_id, doctor_id?, service_type_id, location_id,
//          slot_start, slot_end, booking_channel? }
//     → { ok: true, appointment_id }
//
// The DB has an exclusion constraint (appointment_no_doctor_overlap) — a
// doctor double-book surfaces as a friendly 409.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getSupabaseService } from "../../../lib/supabase-service";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { canWriteIntake } from "../../../lib/roles";
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
