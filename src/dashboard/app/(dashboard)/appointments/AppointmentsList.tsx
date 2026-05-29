// Server component: queries today's appointments for one tab.
// appointment JOIN patient + staff (doctor, LEFT) + service_type.
// SECURITY: national_id_number (CCCD) is NOT selected — D-identity gate.
// PER-DOCTOR SCOPE: when scope === "me" and the caller is a doctor, the
// query is narrowed to doctor_id = current staff.id ("Lịch của tôi").

import StatusBadge from "../StatusBadge";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getCurrentStaff, isDoctorRole } from "../../../lib/current-staff";

type Tab = "pending" | "confirmed";
type Scope = "all" | "me";

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

const TH = "px-4 py-2.5 font-medium";
const TD = "px-4 py-2.5";

export default async function AppointmentsList({
  tab,
  scope = "all",
}: {
  tab: Tab;
  scope?: Scope;
}) {
  const supabase = await getSupabaseServer();
  const staff = await getCurrentStaff();

  // Default window: today (local day boundaries).
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // "me" scope only applies when the caller is a doctor with a staff row
  // linked. Anyone else (CSKH, RECEPTION, unlinked) falls back to "all".
  const meFilter = scope === "me" && isDoctorRole(staff);

  let query = supabase
    .from("appointment")
    .select(SELECT_COLUMNS)
    .in("status", STATUS_BY_TAB[tab])
    .gte("slot_start", startOfDay.toISOString())
    .lt("slot_start", endOfDay.toISOString())
    .order("slot_start", { ascending: true })
    .limit(50);

  if (meFilter && staff) {
    query = query.eq("doctor_id", staff.id);
  }

  const { data, error } = await query;

  const rows = (data as AppointmentRow[] | null) ?? [];
  const isPending = tab === "pending";
  const colCount = 7;

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <table className="min-w-full divide-y divide-[#e4e4e7] text-sm">
          <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
            <tr>
              <th className={TH}>STT</th>
              <th className={TH}>Bệnh nhân</th>
              {isPending ? (
                <>
                  <th className={TH}>SĐT</th>
                  <th className={TH}>Dịch vụ</th>
                  <th className={TH}>Giờ hẹn</th>
                  <th className={TH}>Kênh đặt</th>
                </>
              ) : (
                <>
                  <th className={TH}>Bác sĩ</th>
                  <th className={TH}>Bắt đầu</th>
                  <th className={TH}>Kết thúc</th>
                  <th className={TH}>Phòng</th>
                </>
              )}
              <th className={TH}>Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f4f5]">
            {rows.map((a) => (
              <tr
                key={a.id}
                className="transition-colors duration-150 hover:bg-[#f9fafb]"
              >
                <td className={`${TD} font-mono text-xs text-[#4d4d4d]`}>
                  {a.queue_number ?? "—"}
                </td>
                <td className={`${TD} text-[#171717]`}>
                  {a.patient?.full_name ?? "—"}
                  {a.patient?.patient_code && (
                    <span className="ml-2 font-mono text-xs text-[#888888]">
                      {a.patient.patient_code}
                    </span>
                  )}
                </td>
                {isPending ? (
                  <>
                    <td className={`${TD} font-mono text-xs text-[#4d4d4d]`}>
                      {a.patient?.phone_primary ?? "—"}
                    </td>
                    <td className={`${TD} text-[#4d4d4d]`}>
                      {a.service?.name ?? "—"}
                    </td>
                    <td className={`${TD} font-mono text-xs text-[#4d4d4d]`}>
                      {fmtTime(a.slot_start)}
                    </td>
                    <td className={`${TD} text-[#4d4d4d]`}>
                      {a.booking_channel ?? "—"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={`${TD} text-[#4d4d4d]`}>
                      {a.doctor?.full_name ?? "—"}
                    </td>
                    <td className={`${TD} font-mono text-xs text-[#4d4d4d]`}>
                      {fmtTime(a.slot_start)}
                    </td>
                    <td className={`${TD} font-mono text-xs text-[#4d4d4d]`}>
                      {fmtTime(a.slot_end)}
                    </td>
                    <td className={`${TD} text-[#4d4d4d]`}>
                      {a.assigned_station ?? "—"}
                    </td>
                  </>
                )}
                <td className={TD}>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-6 text-center text-[#888888]"
                >
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
