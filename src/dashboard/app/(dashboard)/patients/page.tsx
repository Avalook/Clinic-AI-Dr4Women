// Read-only patient list with a search box on patient_code / full_name.
// SECURITY: national_id_number (CCCD) is intentionally NOT selected — D-identity.

import PatientsList from "./PatientsList";
import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { vnTodayRangeUtc, vnMonthStartUtc } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await getSupabaseServer();

  // Day / month boundaries in Vietnam time (the server runs in UTC).
  const { startUtc: startOfDay } = vnTodayRangeUtc();
  const startOfMonth = vnMonthStartUtc();

  // Count-only queries (head: true) — no rows fetched.
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
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Bệnh nhân</h1>
        <p className="text-sm text-[#888888]">
          Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng bệnh nhân" value={totalRes.count ?? 0} />
        <StatCard label="Thêm mới hôm nay" value={todayRes.count ?? 0} />
        <StatCard label="Thêm mới tháng này" value={monthRes.count ?? 0} />
      </div>

      <PatientsList searchParams={searchParams} />
    </div>
  );
}
