// GET /api/clinical-record?patientId=<uuid>
// Trả data lâm sàng CÓ SẴN của 1 bệnh nhân để dựng hồ sơ (TÓM TẮT KHÁM BỆNH):
//   - profile: patient_medical_profile (dị ứng / mạn tính / phẫu thuật / gia đình)
//   - pregnancy: thai kỳ đang theo dõi (EDD, tuổi thai)
//   - labs: kết quả xét nghiệm gần đây (đồng bộ từ máy XN)
// CHỈ ĐỌC. Phần GHI hồ sơ (visit FINALIZED / lab GROUP_C) KHÔNG đụng ở đây.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "Thiếu patientId." }, { status: 400 });
  }

  const [profileRes, pregRes, labRes] = await Promise.all([
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
  ]);

  return NextResponse.json({
    profile: profileRes.data ?? null,
    pregnancy: pregRes.data ?? null,
    labs: labRes.data ?? [],
  });
}
