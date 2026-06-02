// "Công việc của tôi" (CSKH) = Tình trạng lịch hẹn (kanban theo dõi hồ sơ).
// Chờ xác nhận → Đã xác nhận. Click tên KH để xem/sửa thông tin + xác nhận.
// (Trang "staff_task" cũ giữ ở TasksRealtime.tsx — chưa dùng, chưa xoá.)
// CCCD KHÔNG select (D-identity).

import { getSupabaseServer } from "../../../lib/supabase-server";
import { vnTodayRangeUtc } from "../../../lib/datetime";
import ConfirmBoard, { type ApptRow, type Opt } from "./ConfirmBoard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const SELECT = `
  id, slot_start, status, booking_channel,
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
      .in("status", ["SCHEDULED", "CONFIRMED", "CHECKED_IN"])
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
        <ConfirmBoard rows={rows} locations={locations} />
      )}
    </div>
  );
}
