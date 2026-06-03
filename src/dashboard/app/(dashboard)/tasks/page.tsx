// "Công việc của tôi" (CSKH) = Tình trạng lịch hẹn (kanban theo dõi hồ sơ).
// Chờ xác nhận → Đã xác nhận. Click tên KH để xem/sửa thông tin + xác nhận.
// (Trang "staff_task" cũ giữ ở TasksRealtime.tsx — chưa dùng, chưa xoá.)
// CCCD KHÔNG select (D-identity).

import { getSupabaseServer } from "../../../lib/supabase-server";
import { vnTodayRangeUtc, fmtDate } from "../../../lib/datetime";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isDoctorRole } from "../../../lib/roles";
import ConfirmBoard, { type ApptRow, type Opt } from "./ConfirmBoard";
import CskhActionBoard, { type CskhActionRow } from "./CskhActionBoard";
import DoctorWorkBoard, {
  type DoctorDay,
  type DoctorApptRow,
} from "./DoctorWorkBoard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

// Bác sĩ: lịch của MÌNH (đủ trường hành chính để dựng hồ sơ lâm sàng).
const DOCTOR_SELECT = `
  id, slot_start, status,
  patient:patient!clinic_patient_id (
    clinic_patient_id, patient_code, full_name, date_of_birth, national_id_number,
    phone_primary, phone_secondary, gender, ethnicity, nationality, occupation,
    patient_objection, address, guardian_name
  ),
  service:service_type!service_type_id ( name )
`;

async function DoctorTasks() {
  const supabase = await getSupabaseServer();
  const staffId = await getClinicStaffId();
  const { startUtc } = vnTodayRangeUtc();
  const N = 7;
  const endUtc = new Date(new Date(startUtc).getTime() + N * DAY_MS).toISOString();

  let q = supabase
    .from("appointment")
    .select(DOCTOR_SELECT)
    .gte("slot_start", startUtc)
    .lt("slot_start", endUtc)
    .order("slot_start", { ascending: true })
    .limit(400);
  if (staffId) q = q.eq("doctor_id", staffId);
  const { data, error } = await q;
  const rows = (data as DoctorApptRow[] | null) ?? [];

  // Gom theo ngày VN (startUtc đã là 00:00 giờ VN; VN không có DST nên +DAY_MS chuẩn).
  const t0 = new Date(startUtc).getTime();
  const days: DoctorDay[] = Array.from({ length: N }, (_, i) => {
    const s = t0 + i * DAY_MS;
    const e = s + DAY_MS;
    const items = rows.filter((r) => {
      const t = new Date(r.slot_start).getTime();
      return t >= s && t < e;
    });
    const label = i === 0 ? "Hôm nay" : i === 1 ? "Ngày mai" : fmtDate(new Date(s));
    return { label, items };
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Công việc của tôi</h1>
        <p className="text-sm text-[#888888]">
          Lịch khám của bạn theo ngày · bấm tên bệnh nhân để mở hồ sơ lâm sàng.
        </p>
      </header>
      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <DoctorWorkBoard days={days} staffId={staffId} />
      )}
    </div>
  );
}

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
  // Bác sĩ thấy board lâm sàng riêng; CSKH/Quản lý thấy board lịch hẹn cũ.
  const role = await getClinicRole();
  if (isDoctorRole(role)) return DoctorTasks();

  const supabase = await getSupabaseServer();
  const { startUtc } = vnTodayRangeUtc();
  // Hàng đợi CSKH: từ hôm nay tới 7 ngày tới, các lịch chờ/đã xác nhận.
  const endUtc = new Date(new Date(startUtc).getTime() + 7 * DAY_MS).toISOString();

  const CSKH_SELECT = `
    id, category, status, description, action_data, source_created_at, created_by_text,
    patient:patient!clinic_patient_id (
      clinic_patient_id, full_name, patient_code, phone_primary
    )
  `;

  const [apptRes, locRes, cskhRes] = await Promise.all([
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
    // Bảng 2: nhật ký việc CSKH (CSKH-Action), 200 việc gần nhất.
    supabase
      .from("cskh_action")
      .select(CSKH_SELECT)
      .order("source_created_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  const rows = (apptRes.data as ApptRow[] | null) ?? [];
  const cskhRows = (cskhRes.data as CskhActionRow[] | null) ?? [];
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
                Nhật ký việc CSKH theo loại (từ bảng CSKH-Action) · mỗi thẻ = 1 lần
                thao tác với khách.
              </p>
              <p className="mt-1 inline-flex rounded-md bg-[#eff6ff] px-2 py-0.5 text-xs text-[#1d4ed8]">
                🤖 Phần này sẽ tự ghi khi nối Zalo / Pancake — CSKH không phải nhập tay.
              </p>
            </div>
            {cskhRes.error ? (
              <div className="rounded-md bg-[#fef9c3] px-3 py-2 text-sm text-[#a16207]">
                Chưa đọc được CSKH-Action: {cskhRes.error.message}
              </div>
            ) : (
              <CskhActionBoard rows={cskhRows} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
