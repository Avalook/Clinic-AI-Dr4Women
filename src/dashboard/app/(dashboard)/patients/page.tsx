// Read-only patient list with a search box on patient_code / full_name.
// Bác sĩ chỉ thấy BN của mình (qua RPC doctor_patient_list); vai trò khác thấy
// toàn bộ. SECURITY: national_id_number (CCCD) KHÔNG select — D-identity.

import PatientsList from "./PatientsList";
import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isDoctorRole } from "../../../lib/roles";
import { vnTodayRangeUtc, vnMonthStartUtc } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const isDoctor = isDoctorRole(role);
  const doctorId = isDoctor ? await getClinicStaffId() : null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          {isDoctor ? "Bệnh nhân của tôi" : "Bệnh nhân"}
        </h1>
        <p className="text-sm text-[#888888]">
          {isDoctor
            ? "Chỉ hiển thị bệnh nhân bạn đã/đang khám. CCCD KHÔNG hiển thị."
            : "Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity)."}
        </p>
      </header>

      {isDoctor ? (
        <DoctorStats doctorId={doctorId} />
      ) : (
        <ClinicStats supabase={supabase} />
      )}

      <PatientsList searchParams={searchParams} doctorId={doctorId} />
    </div>
  );
}

async function DoctorStats({ doctorId }: { doctorId: string | null }) {
  const supabase = await getSupabaseServer();
  let count = 0;
  if (doctorId) {
    const { data } = await supabase.rpc("doctor_patient_count", {
      p_doctor_id: doctorId,
    });
    count = Number(data ?? 0);
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Tổng bệnh nhân của tôi" value={count} />
    </div>
  );
}

async function ClinicStats({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>;
}) {
  const { startUtc: startOfDay } = vnTodayRangeUtc();
  const startOfMonth = vnMonthStartUtc();
  const [totalRes, todayRes, monthRes] = await Promise.all([
    supabase.from("patient").select("*", { count: "exact", head: true }),
    supabase
      .from("patient")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfDay),
    supabase
      .from("patient")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
  ]);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Tổng bệnh nhân" value={totalRes.count ?? 0} />
      <StatCard label="Thêm mới hôm nay" value={todayRes.count ?? 0} />
      <StatCard label="Thêm mới tháng này" value={monthRes.count ?? 0} />
    </div>
  );
}
