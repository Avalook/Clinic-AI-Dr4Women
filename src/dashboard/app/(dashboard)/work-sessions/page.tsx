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
        <h1 className="text-xl font-semibold text-gray-900">Work Sessions</h1>
        <p className="text-sm text-gray-500">
          100 ca làm gần nhất, sắp theo ngày giảm dần. Read-only.
        </p>
      </header>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Giờ</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Số staff</th>
              <th className="px-3 py-2">Max BN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data as WorkSessionRow[] | null)?.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-mono text-xs">{s.session_date}</td>
                <td className="px-3 py-2">{s.session_type}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {s.start_time} – {s.end_time}
                </td>
                <td className="px-3 py-2">
                  {s.clinic_location?.name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {s.work_session_staff?.[0]?.count ?? 0}
                </td>
                <td className="px-3 py-2">{s.max_patients ?? "—"}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
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
