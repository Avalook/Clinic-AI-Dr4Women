// Server component: queries today's appointments for one tab.
// appointment JOIN patient + staff (doctor, LEFT) + service_type.
// SECURITY: national_id_number (CCCD) is NOT selected — D-identity gate.

import { getSupabaseServer } from "../../../lib/supabase-server";

type Tab = "pending" | "confirmed";

// Status sets per tab (see appointment.status CHECK constraint).
const STATUS_BY_TAB: Record<Tab, string[]> = {
  pending: ["SCHEDULED"],
  confirmed: ["CONFIRMED", "CHECKED_IN"],
};

interface AppointmentRow {
  id: string;
  queue_number: string | null;
  booking_channel: string | null;
  slot_start: string;
  slot_end: string;
  assigned_station: string | null;
  status: string;
  patient: {
    full_name: string;
    phone_primary: string | null;
    patient_code: string;
  } | null;
  doctor: { full_name: string } | null;
  service: { name: string } | null;
}

// Embedded resources aliased; doctor is a LEFT JOIN (doctor_id is nullable).
const SELECT_COLUMNS = `
  id, queue_number, booking_channel, slot_start, slot_end, assigned_station, status,
  patient:patient!clinic_patient_id ( full_name, phone_primary, patient_code ),
  doctor:staff!doctor_id ( full_name ),
  service:service_type!service_type_id ( name )
`;

function fmtTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default async function AppointmentsList({ tab }: { tab: Tab }) {
  const supabase = await getSupabaseServer();

  // Default window: today (local day boundaries).
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await supabase
    .from("appointment")
    .select(SELECT_COLUMNS)
    .in("status", STATUS_BY_TAB[tab])
    .gte("slot_start", startOfDay.toISOString())
    .lt("slot_start", endOfDay.toISOString())
    .order("slot_start", { ascending: true })
    .limit(50);

  const rows = (data as AppointmentRow[] | null) ?? [];
  const isPending = tab === "pending";
  const colCount = 6;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">STT</th>
              <th className="px-3 py-2">Bệnh nhân</th>
              {isPending ? (
                <>
                  <th className="px-3 py-2">SĐT</th>
                  <th className="px-3 py-2">Dịch vụ</th>
                  <th className="px-3 py-2">Giờ hẹn</th>
                  <th className="px-3 py-2">Kênh đặt</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2">Bác sĩ</th>
                  <th className="px-3 py-2">Bắt đầu</th>
                  <th className="px-3 py-2">Kết thúc</th>
                  <th className="px-3 py-2">Phòng</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  {a.queue_number ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {a.patient?.full_name ?? "—"}
                  {a.patient?.patient_code && (
                    <span className="ml-2 font-mono text-xs text-gray-400">
                      {a.patient.patient_code}
                    </span>
                  )}
                </td>
                {isPending ? (
                  <>
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.patient?.phone_primary ?? "—"}
                    </td>
                    <td className="px-3 py-2">{a.service?.name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmtTime(a.slot_start)}
                    </td>
                    <td className="px-3 py-2">{a.booking_channel ?? "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">{a.doctor?.full_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmtTime(a.slot_start)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmtTime(a.slot_end)}
                    </td>
                    <td className="px-3 py-2">{a.assigned_station ?? "—"}</td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-6 text-center text-gray-500">
                  Không có lịch hẹn hôm nay.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
