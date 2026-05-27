// Server Component — reads from Supabase via the SSR client, RLS-gated by
// the authenticated user's session.

import { getSupabaseServer } from "../../../lib/supabase-server";

interface WorkSessionRow {
  id: string;
  location_id: string;
  session_date: string;
  session_type: string;
  start_time: string;
  end_time: string;
  max_patients: number | null;
  clinic_location: { name: string | null } | null;
  work_session_staff: { count: number }[];
}

export const dynamic = "force-dynamic";

export default async function WorkSessionsPage() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from("work_session")
    .select(
      // Field names verified against migration 009/010/001 (Step 1).
      "id, location_id, session_date, session_type, start_time, end_time, max_patients, " +
        "clinic_location:clinic_location ( name ), " +
        "work_session_staff ( count )",
    )
    .order("session_date", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Ca trực</h1>
        <p className="text-sm text-[#888888]">
          100 ca làm gần nhất, sắp theo ngày giảm dần. Read-only.
        </p>
      </header>

      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <table className="min-w-full divide-y divide-[#e4e4e7] text-sm">
          <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Ngày</th>
              <th className="px-4 py-2.5 font-medium">Session</th>
              <th className="px-4 py-2.5 font-medium">Giờ</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Số staff</th>
              <th className="px-4 py-2.5 font-medium">Max BN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f4f5]">
            {(data as WorkSessionRow[] | null)?.map((s) => (
              <tr
                key={s.id}
                className="transition-colors duration-150 hover:bg-[#f9fafb]"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-[#4d4d4d]">
                  {s.session_date}
                </td>
                <td className="px-4 py-2.5 text-[#171717]">{s.session_type}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-[#4d4d4d]">
                  {s.start_time} – {s.end_time}
                </td>
                <td className="px-4 py-2.5 text-[#4d4d4d]">
                  {s.clinic_location?.name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[#4d4d4d]">
                  {s.work_session_staff?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2.5 text-[#4d4d4d]">
                  {s.max_patients ?? "—"}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#888888]">
                  Chưa có ca làm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
