// /api/clinical-record
//   GET  ?patientId=&appointmentId=  → data đồng bộ (tiền sử/thai/XN) + bản NHÁP
//        hồ sơ khám của lịch này (để prefill phần bác sĩ điền).
//   POST { appointmentId, clinicPatientId, draft } → LƯU NHÁP hồ sơ khám.
//
// AN TOÀN (TT13/2011/TT-BYT): chỉ ghi vào visit OPEN/IN_PROGRESS; nếu visit đã
// FINALIZED → 409 (luật cấm sửa, phải đính chính). KHÔNG bao giờ tự set FINALIZED.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getSupabaseService } from "../../../lib/supabase-service";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isDoctorRole } from "../../../lib/roles";

interface ClinicalRecordRow {
  chief_complaint_at_visit: string | null;
  soap_subjective: unknown;
  soap_objective: unknown;
  soap_assessment: unknown;
  soap_plan: unknown;
}
interface VisitRow {
  visit_id: string;
  status: string;
  clinical_record: ClinicalRecordRow | ClinicalRecordRow[] | null;
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");
  const appointmentId = url.searchParams.get("appointmentId");
  if (!patientId) {
    return NextResponse.json({ error: "Thiếu patientId." }, { status: 400 });
  }

  const [profileRes, pregRes, labRes, visitRes] = await Promise.all([
    supabase
      .from("patient_medical_profile")
      .select(
        "blood_type, allergies, chronic_diseases, current_medications, surgical_history, family_history, notes",
      )
      .eq("clinic_patient_id", patientId)
      .maybeSingle(),
    supabase
      .from("pregnancy")
      .select("edd_date, gestational_age_at_registration, is_high_risk, high_risk_reason, outcome")
      .eq("clinic_patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lab_result")
      .select(
        "test_name, result_value, result_numeric, result_unit, flag, triage_group, result_received_at",
      )
      .eq("clinic_patient_id", patientId)
      .order("result_received_at", { ascending: false })
      .limit(20),
    appointmentId
      ? supabase
          .from("visit")
          .select(
            "visit_id, status, clinical_record ( chief_complaint_at_visit, soap_subjective, soap_objective, soap_assessment, soap_plan )",
          )
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const visit = (visitRes.data as VisitRow | null) ?? null;
  const cr = visit
    ? Array.isArray(visit.clinical_record)
      ? visit.clinical_record[0]
      : visit.clinical_record
    : null;

  return NextResponse.json({
    profile: profileRes.data ?? null,
    pregnancy: pregRes.data ?? null,
    labs: labRes.data ?? [],
    visit: visit ? { visit_id: visit.visit_id, status: visit.status } : null,
    draft: {
      chief_complaint: cr?.chief_complaint_at_visit ?? "",
      subjective: cr?.soap_subjective ?? null,
      objective: cr?.soap_objective ?? null,
      assessment: cr?.soap_assessment ?? null,
      plan: cr?.soap_plan ?? null,
    },
  });
}

interface PostBody {
  appointmentId?: string;
  clinicPatientId?: string;
  chief_complaint?: string;
  subjective?: unknown;
  objective?: unknown;
  assessment?: unknown;
  plan?: unknown;
  // Tiền sử (mục III/IV) — patient-level, bác sĩ xác nhận/cập nhật.
  profile?: {
    allergies?: string[];
    blood_type?: string | null;
    chronic_diseases?: string[];
    surgical_history?: string[];
    current_medications?: string[];
    family_history?: unknown;
    notes?: string | null;
  };
}

export async function POST(request: Request) {
  const caller = await getSupabaseServer();
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const role = await getClinicRole();
  if (!isDoctorRole(role)) {
    return NextResponse.json(
      { error: "Chỉ bác sĩ mới ghi hồ sơ khám." },
      { status: 403 },
    );
  }
  const staffId = await getClinicStaffId();

  const db = getSupabaseService();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa cấu hình trên server." },
      { status: 503 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const appointmentId = (body.appointmentId ?? "").trim();
  const clinicPatientId = (body.clinicPatientId ?? "").trim();
  if (!appointmentId || !clinicPatientId) {
    return NextResponse.json(
      { error: "Thiếu lịch hẹn hoặc bệnh nhân." },
      { status: 400 },
    );
  }

  // Tìm lượt khám gắn với lịch hẹn này.
  const { data: existing, error: findErr } = await db
    .from("visit")
    .select("visit_id, status")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  let visitId = existing?.visit_id ?? null;
  if (existing && existing.status === "FINALIZED") {
    return NextResponse.json(
      { error: "Hồ sơ đã chốt (FINALIZED) — luật cấm sửa, phải đính chính." },
      { status: 409 },
    );
  }

  // Chưa có lượt khám → tạo NHÁP (IN_PROGRESS), KHÔNG chốt.
  if (!visitId) {
    const { data: created, error: vErr } = await db
      .from("visit")
      .insert({
        clinic_patient_id: clinicPatientId,
        appointment_id: appointmentId,
        attending_doctor_id: staffId,
        status: "IN_PROGRESS",
      })
      .select("visit_id")
      .single();
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    visitId = created.visit_id;
  }

  // Upsert nội dung khám (clinical_record.visit_id UNIQUE).
  const { error: crErr } = await db.from("clinical_record").upsert(
    {
      visit_id: visitId,
      chief_complaint_at_visit: (body.chief_complaint ?? "").trim() || null,
      soap_subjective: body.subjective ?? null,
      soap_objective: body.objective ?? null,
      soap_assessment: body.assessment ?? null,
      soap_plan: body.plan ?? null,
    },
    { onConflict: "visit_id" },
  );
  if (crErr) return NextResponse.json({ error: crErr.message }, { status: 500 });

  // Tiền sử (patient-level) — upsert theo clinic_patient_id (UNIQUE). Không gate.
  if (body.profile) {
    const { error: pErr } = await db.from("patient_medical_profile").upsert(
      { clinic_patient_id: clinicPatientId, ...body.profile },
      { onConflict: "clinic_patient_id" },
    );
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, visit_id: visitId });
}
