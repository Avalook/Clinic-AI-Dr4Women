// "Công việc của tôi" (CSKH) = Tình trạng lịch hẹn (kanban theo dõi hồ sơ).
// Chờ xác nhận → Đã xác nhận. Click tên KH để xem/sửa thông tin + xác nhận.
// (Trang "staff_task" cũ giữ ở TasksRealtime.tsx — chưa dùng, chưa xoá.)
// CCCD KHÔNG select (D-identity).

import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  vnTodayRangeUtc,
  vnLocalToUtcISO,
  vnMonthStartUtc,
} from "../../../lib/datetime";
import { currentWeekStartVn } from "../../../lib/roster";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isDoctorRole, canManageAppt, isTasksReadOnly } from "../../../lib/roles";
import ConfirmBoard, { type ApptRow, type Opt } from "./ConfirmBoard";
import CskhActionBoard, { type CskhActionRow } from "./CskhActionBoard";
import DoctorWorkBoard, { type DoctorApptRow } from "./DoctorWorkBoard";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

// Bác sĩ: lịch của MÌNH (đủ trường hành chính để dựng hồ sơ lâm sàng).
const DOCTOR_SELECT = `
  id, slot_start, status, queue_number,
  patient:patient!clinic_patient_id (
    clinic_patient_id, patient_code, full_name, date_of_birth,
    phone_primary, phone_secondary, gender, ethnicity, nationality, occupation,
    patient_objection, address, guardian_name
  ),
  service:service_type!service_type_id ( name )
`;

// readOnly = LỄ TÂN xem clone giao diện board bác sĩ ở chế độ CHỈ ĐỌC. Lễ tân
// VẪN có clinic_staff_id (cookie set cho mọi vai trò) nhưng KHÔNG phải bác sĩ →
// khi readOnly ta BỎ lọc doctor_id để thấy lịch của MỌI bác sĩ (góc nhìn front
// desk). Nếu lọc theo staffId của lễ tân thì board sẽ rỗng (không lịch nào của họ).
async function DoctorTasks(readOnly = false) {
  const supabase = await getSupabaseServer();
  const staffId = await getClinicStaffId();
  const { startUtc } = vnTodayRangeUtc();
  // Cửa sổ 31 ngày tới: đủ cho bộ lọc Tuần này / Tuần sau / Tháng này ở board bác sĩ.
  const N = 31;
  const endUtc = new Date(new Date(startUtc).getTime() + N * DAY_MS).toISOString();
  // Mốc ĐỌC lùi về sớm nhất board có thể lọc (đầu TUẦN hoặc đầu THÁNG hiện tại) —
  // nếu chỉ đọc từ HÔM NAY thì "Tuần này"/"Tháng này" mất phần đầu kỳ đã qua (vd vào
  // Thứ Năm không thấy lịch T2–T4 của chính tuần đó). So sánh chuỗi ISO-UTC = so giờ.
  const readStartUtc = [
    startUtc,
    vnLocalToUtcISO(currentWeekStartVn(), "00:00"),
    vnMonthStartUtc(),
  ].sort()[0];

  let q = supabase
    .from("appointment")
    .select(DOCTOR_SELECT)
    .gte("slot_start", readStartUtc)
    .lt("slot_start", endUtc)
    .order("slot_start", { ascending: true })
    .limit(400);
  // Bác sĩ: chỉ lịch của MÌNH. Lễ tân (readOnly): KHÔNG lọc → mọi bác sĩ.
  if (staffId && !readOnly) q = q.eq("doctor_id", staffId);
  const { data, error } = await q;
  const rows = (data as DoctorApptRow[] | null) ?? [];

  // "Phân loại khám" (Khám lần đầu / Tái khám) — suy từ lịch sử hẹn của BN: lịch
  // SỚM NHẤT của BN = Khám lần đầu, các lịch sau = Tái khám. DB chưa có cột riêng
  // → suy luận nhất quán (giống bảng "Lịch hẹn khám" ở Trang chủ), KHÔNG bịa số.
  const pids = [
    ...new Set(
      rows
        .map((r) => r.patient?.clinic_patient_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const earliest = new Map<string, number>();
  if (pids.length) {
    const { data: prior } = await supabase
      .from("appointment")
      .select("clinic_patient_id, slot_start")
      .in("clinic_patient_id", pids);
    for (const r of (prior as
      | { clinic_patient_id: string; slot_start: string }[]
      | null) ?? []) {
      const t = new Date(r.slot_start).getTime();
      const cur = earliest.get(r.clinic_patient_id);
      if (cur === undefined || t < cur) earliest.set(r.clinic_patient_id, t);
    }
  }
  const withPhanLoai: DoctorApptRow[] = rows.map((r) => {
    const pid = r.patient?.clinic_patient_id;
    const e = pid ? earliest.get(pid) : undefined;
    const phan_loai =
      e === undefined
        ? ""
        : new Date(r.slot_start).getTime() > e
          ? "Tái khám"
          : "Khám lần đầu";
    return { ...r, phan_loai };
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Công việc của tôi</h1>
        {readOnly && (
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-[#9d2463]">
            <span className="rounded bg-[#fce7f3] px-1.5 py-0.5 text-[11px] font-medium">
              👁 Chế độ chỉ xem
            </span>
            <span className="text-[#888888]">
              Lễ tân xem lịch & hồ sơ của tất cả bác sĩ — không chỉnh sửa.
            </span>
          </p>
        )}
      </header>
      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <DoctorWorkBoard
          rows={withPhanLoai}
          staffId={staffId}
          readOnly={readOnly}
          /* Lễ tân (readOnly): khóa lâm sàng nhưng ĐƯỢC sửa hành chính mục I.
             Bác sĩ (readOnly=false): không bật sửa hành chính ở đây. */
          canEditAdmin={readOnly}
        />
      )}
    </div>
  );
}

const SELECT = `
  id, slot_start, status, booking_channel, cancellation_reason, cancelled_at,
  patient:patient!clinic_patient_id (
    clinic_patient_id, full_name, patient_code, phone_primary,
    phone_secondary, date_of_birth, location_id, gender, ethnicity,
    nationality, occupation, patient_objection, address, guardian_name
  ),
  doctor:staff!doctor_id ( full_name ),
  service:service_type!service_type_id ( name )
`;

export default async function TasksPage() {
  // Bác sĩ thấy board lâm sàng riêng; CSKH/Quản lý thấy board lịch hẹn cũ.
  const role = await getClinicRole();
  if (isDoctorRole(role)) return DoctorTasks();
  // Lễ tân: CLONE Y HỆT board bác sĩ nhưng CHỈ ĐỌC (khóa mọi nút sửa).
  if (isTasksReadOnly(role)) return DoctorTasks(true);

  const supabase = await getSupabaseServer();
  const { startUtc } = vnTodayRangeUtc();
  // Hàng đợi CSKH: hôm nay → 31 ngày tới (mở rộng từ 7) để lịch CSKH vừa đặt cho
  // tuần/tháng sau VẪN hiện ở "Tình trạng lịch hẹn" (feedback B5#6).
  const endUtc = new Date(new Date(startUtc).getTime() + 31 * DAY_MS).toISOString();

  // Bảng 2 (Nhật ký CSKH) — đọc 200 việc gần nhất từ cskh_action.
  const CSKH_SELECT = `
    id, category, status, description, action_data, source_created_at, created_by_text,
    patient:patient!clinic_patient_id (
      clinic_patient_id, full_name, patient_code, phone_primary
    )
  `;

  const [apptRes, locRes, cskhRes, docRes] = await Promise.all([
    supabase
      .from("appointment")
      .select(SELECT)
      // Board 4 cột: Chờ xác nhận → Đã xác nhận → Đã khám xong → Đã huỷ / Từ chối.
      // Cột cuối để CSKH THẤY lịch bác sĩ từ chối (DOCTOR_DECLINED) + hủy + không đến.
      .in("status", [
        "SCHEDULED",
        "CSKH_CONFIRMED",
        "CONFIRMED",
        "CHECKED_IN",
        "COMPLETED",
        "CANCELLED",
        "DOCTOR_DECLINED",
        "NO_SHOW",
      ])
      .gte("slot_start", startUtc)
      .lt("slot_start", endUtc)
      .order("slot_start", { ascending: true })
      .limit(300),
    supabase.from("clinic_location").select("id, name").order("name"),
    supabase
      .from("cskh_action")
      .select(CSKH_SELECT)
      .order("source_created_at", { ascending: false, nullsFirst: false })
      .limit(200),
    // Bác sĩ để PHÂN LẠI lịch bị từ chối.
    supabase
      .from("staff")
      .select("id, full_name")
      .in("primary_department", ["DOCTOR", "ULTRASOUND_DOCTOR"])
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const rows = (apptRes.data as ApptRow[] | null) ?? [];
  const cskhRows = (cskhRes.data as CskhActionRow[] | null) ?? [];
  const locations: Opt[] = (locRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.name as string,
  }));
  const doctors: Opt[] = (docRes.data ?? []).map((r) => ({
    id: r.id as string,
    label: r.full_name as string,
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
          <ConfirmBoard
            rows={rows}
            locations={locations}
            doctors={doctors}
            canManage={canManageAppt(role)}
          />

          {/* Ý nghĩa từng trạng thái — để phòng khám đọc hiểu (PM yêu cầu) */}
          <dl className="grid gap-2.5 rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-xs text-[#52525b] sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                dot: "#2563eb",
                term: "Chờ xác nhận",
                desc: "Lịch mới đặt, CSKH chưa gọi xác nhận với khách.",
              },
              {
                dot: "#16a34a",
                term: "Đã xác nhận",
                desc: "CSKH đã gọi xác nhận với khách (chờ bác sĩ nhận ca), hoặc bác sĩ đã nhận / khách đã đến.",
              },
              {
                dot: "#71717a",
                term: "Đã khám xong",
                desc: "Khách đã khám xong lượt này.",
              },
              {
                dot: "#dc2626",
                term: "Đã huỷ / Từ chối",
                desc: "Lịch bị hủy, bác sĩ từ chối, hoặc khách không đến.",
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

          {/* Bảng 2 — Nhật ký CSKH (CSKH-Action). ĐANG XÂY DỰNG: data sẽ tự ghi
              khi nối Zalo/Pancake; hiện CSKH có thể ghi tay 1 việc qua nút "+". */}
          <section className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-[#171717]">
                Nhật ký chăm sóc khách hàng (CSKH)
              </h2>
              <p className="text-sm text-[#888888]">
                Các việc CSKH theo loại (từ bảng CSKH-Action) · mỗi thẻ = 1 lần
                thao tác với khách. Bấm “+ Thêm việc” trên mỗi cột để ghi tay.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#a16207]">
                  🚧 Đang xây dựng
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#eff6ff] px-2 py-0.5 text-xs text-[#1d4ed8]">
                  🤖 Tự ghi khi CSKH thao tác (xác nhận lịch → vào “Đặt hẹn”
                  ngay) + về sau khi nối Zalo / Pancake.
                </span>
              </div>
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
