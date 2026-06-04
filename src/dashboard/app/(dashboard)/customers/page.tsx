// "Thông tin khách hàng" — danh bạ khách đã nhập (master-detail). Server đọc
// patient qua Supabase RLS, lọc theo created_at (Hôm nay/Tuần/Tháng) + tìm
// tên/mã/SĐT; client (CustomersView) lo chọn + bôi hồng.

import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  vnTodayRangeUtc,
  vnMonthStartUtc,
  vnLocalToUtcISO,
} from "../../../lib/datetime";
import { currentWeekStartVn } from "../../../lib/roster";
import CustomersView, {
  type CustomerRow,
  type Opt,
  type Period,
} from "./CustomersView";

export const dynamic = "force-dynamic";

function sinceFor(period: Period): string | null {
  if (period === "today") return vnTodayRangeUtc().startUtc;
  if (period === "week") return vnLocalToUtcISO(currentWeekStartVn(), "00:00");
  if (period === "month") return vnMonthStartUtc();
  return null;
}

const SELECT = `
  clinic_patient_id, patient_code, full_name, date_of_birth,
  phone_primary, phone_secondary, gender, ethnicity, nationality,
  occupation, patient_objection, address, location_id, created_at
`;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; selected?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const period: Period = (["today", "week", "month", "all"].includes(
    sp.period ?? "",
  )
    ? sp.period
    : "all") as Period;
  const selected = (sp.selected ?? "").trim() || null;
  const since = sinceFor(period);

  const supabase = await getSupabaseServer();

  let query = supabase
    .from("patient")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(300);
  if (since) query = query.gte("created_at", since);
  if (q) {
    // Tìm theo tên / mã BN / SĐT (làm sạch ký tự đặc biệt của cú pháp .or()).
    const t = q.replace(/[,()%*]/g, " ").trim();
    if (t) {
      query = query.or(
        [
          `full_name.ilike.%${t}%`,
          `patient_code.ilike.%${t}%`,
          `phone_primary.ilike.%${t}%`,
        ].join(","),
      );
    }
  }

  const [{ data, error }, locRes] = await Promise.all([
    query,
    supabase.from("clinic_location").select("id, name").order("name"),
  ]);

  const rows = (data as CustomerRow[] | null) ?? [];
  const locations: Opt[] = (locRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Thông tin khách hàng
        </h1>
        <p className="text-sm text-[#888888]">
          Danh bạ khách đã nhập · chọn tên để xem thông tin chi tiết. Khách vừa
          nhập sẽ tự được chọn ở đây.
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <CustomersView
          rows={rows}
          locations={locations}
          q={q}
          period={period}
          initialSelected={selected}
        />
      )}
    </div>
  );
}
