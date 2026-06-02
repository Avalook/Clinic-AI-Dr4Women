// "Công việc của tôi" (CSKH) = Tình trạng lịch hẹn (kanban theo dõi hồ sơ).
// Chờ xác nhận → Đã xác nhận. Click tên KH để xem/sửa thông tin + xác nhận.
// (Trang "staff_task" cũ giữ ở TasksRealtime.tsx — chưa dùng, chưa xoá.)
// CCCD KHÔNG select (D-identity).

import { getSupabaseServer } from "../../../lib/supabase-server";
import { vnTodayRangeUtc } from "../../../lib/datetime";
import ConfirmBoard, { type ApptRow, type Opt } from "./ConfirmBoard";
import TrackBoard from "./TrackBoard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const SELECT = `
  id, slot_start, status, booking_channel, cancellation_reason, cancelled_at,
  patient:patient!clinic_patient_id (
    clinic_patient_id, full_name, patient_code, phone_primary,
    phone_secondary, date_of_birth, location_id
  ),
  doctor:staff!doctor_id ( full_name ),
  service:service_type!service_type_id ( name )
`;

export default async function TasksPage() {
  const supabase = await getSupabaseServer();
  const { startUtc } = vnTodayRangeUtc();
  // Hàng đợi CSKH: từ hôm nay tới 7 ngày tới, các lịch chờ/đã xác nhận.
  const endUtc = new Date(new Date(startUtc).getTime() + 7 * DAY_MS).toISOString();

  const [apptRes, locRes] = await Promise.all([
    supabase
      .from("appointment")
      .select(SELECT)
      // Đủ 7 trạng thái: board trên dùng SCHEDULED/CONFIRMED, board "theo dõi"
      // dùng phần còn lại (đã đến / không đến / hủy / bác sĩ từ chối).
      .in("status", [
        "SCHEDULED",
        "CONFIRMED",
        "CHECKED_IN",
        "COMPLETED",
        "NO_SHOW",
        "CANCELLED",
        "DOCTOR_DECLINED",
      ])
      .gte("slot_start", startUtc)
      .lt("slot_start", endUtc)
      .order("slot_start", { ascending: true })
      .limit(300),
    supabase.from("clinic_location").select("id, name").order("name"),
  ]);

  const rows = (apptRes.data as ApptRow[] | null) ?? [];
  const locations: Opt[] = (locRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          Tình trạng lịch hẹn
        </h1>
        <p className="text-sm text-[#888888]">
          Theo dõi hồ sơ · click tên khách hàng để xem thông tin & xác nhận lịch.
        </p>
      </header>

      {apptRes.error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {apptRes.error.message}
        </div>
      ) : (
        <>
          <ConfirmBoard rows={rows} locations={locations} />

          {/* Ý nghĩa từng trạng thái — để phòng khám đọc hiểu (PM yêu cầu) */}
          <dl className="grid gap-2.5 rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-xs text-[#52525b] sm:grid-cols-3">
            {[
              {
                dot: "#2563eb",
                term: "Chờ xác nhận",
                desc: "Lịch mới đặt, CSKH chưa gọi xác nhận với khách.",
              },
              {
                dot: "#16a34a",
                term: "Đã xác nhận",
                desc: "CSKH đã gọi, khách đồng ý sẽ đến (gồm khách đã check-in tại quầy).",
              },
              {
                dot: "#71717a",
                term: "Đã khám xong",
                desc: "Khách đã khám xong lượt này.",
              },
            ].map((s) => (
              <div key={s.term} className="flex gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.dot }}
                />
                <div>
                  <dt className="font-semibold text-[#171717]">{s.term}</dt>
                  <dd>{s.desc}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-[#171717]">
                Theo dõi tình trạng lịch hẹn
              </h2>
              <p className="text-sm text-[#888888]">
                Các lịch NGOÀI luồng khám · hủy hẹn / không đến / bác sĩ từ chối.
              </p>
            </div>
            <TrackBoard rows={rows} locations={locations} />
          </section>
        </>
      )}
    </div>
  );
}
