// Trang chủ — ĐỒNG BỘ cho mọi vai trò. Giữ ĐÚNG 4 khối:
//  1. Lời chào (chức danh + tên) + ngày hôm nay
//  2. 3 ô số: Việc đang chờ làm · BN mới đăng ký hôm nay · Lịch chờ xác nhận
//  3. Ca trực hôm nay của bạn (từ work_roster)
//
// (Khối "2 mục" Lịch hẹn/Lịch làm việc + "Lối tắt" cũ đã bỏ/ẩn theo yêu cầu —
//  comment "Lối tắt" giữ ở cuối file để dùng lại nếu cần.)

import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  getClinicRole,
  getActiveStaff,
  getClinicStaffId,
} from "../../../lib/clinic-session";
import { type ClinicRole, canCheckin } from "../../../lib/roles";
import HomeCheckin, { type HomeCheckinRow } from "./HomeCheckin";
import type { ActiveStaff } from "../../../lib/clinic-session";
import { vnTodayRangeUtc, fmtDate, vnLocalToUtcISO } from "../../../lib/datetime";
import { currentWeekStartVn, weekDates, weekStartOf } from "../../../lib/roster";
import WeekNav from "../WeekNav";
import WeeklyAppointmentsTable, {
  type ApptDay,
  type WeekApptRow,
} from "./WeeklyAppointmentsTable";
import WorkRosterTable, { type RosterRow } from "./WorkRosterTable";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

// Chức danh ngắn dùng trong lời chào (vd "Chào bác sĩ Thành").
const GREET_LABEL: Record<ClinicRole, string> = {
  DOCTOR: "bác sĩ",
  ULTRASOUND_DOCTOR: "bác sĩ",
  NURSE_ULTRASOUND: "điều dưỡng",
  CSKH: "CSKH",
  MANAGEMENT: "quản lý",
  RECEPTION: "lễ tân",
};

// Bỏ tiền tố chức danh khỏi tên ("BS Thành" → "Thành", "ĐD Hà Vũ" → "Hà Vũ").
function cleanName(name: string): string {
  return name.replace(/^(BS\s*SA|BS|ĐD|TL)\s+/i, "").trim();
}

function greet(role: ClinicRole | null, staff: ActiveStaff | null): string {
  if (!role || !staff) return "Trang chủ";
  return `Chào ${GREET_LABEL[role]} ${cleanName(staff.short_name ?? staff.full_name)}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ weekAppt?: string; weekRoster?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const staff = await getActiveStaff();
  const staffId = await getClinicStaffId();
  const showCheckin = canCheckin(role); // ĐD/Lễ tân/Quản lý: khu check-in ở đây
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // 2 bảng có tuần ĐỘC LẬP: weekAppt cho Lịch hẹn khám, weekRoster cho Lịch làm
  // việc — bấm nút bảng nào CHỈ đổi tuần bảng đó (không kéo theo bảng kia).
  const { weekAppt: rawWeekAppt, weekRoster: rawWeekRoster } = await searchParams;
  const weekAppt = rawWeekAppt ? weekStartOf(rawWeekAppt) : currentWeekStartVn();
  const weekRoster = rawWeekRoster
    ? weekStartOf(rawWeekRoster)
    : currentWeekStartVn();
  const apptDates = weekDates(weekAppt);
  const rosterDates = weekDates(weekRoster);
  const apptStartUtc = vnLocalToUtcISO(weekAppt, "00:00");
  const apptEndUtc = new Date(
    new Date(apptStartUtc).getTime() + 7 * DAY_MS,
  ).toISOString();
  const WEEK_APPT_SELECT = `
    id, slot_start, queue_number,
    patient:patient!clinic_patient_id ( clinic_patient_id, full_name, patient_code, phone_primary ),
    doctor:staff!doctor_id ( full_name ),
    service:service_type!service_type_id ( name )
  `;

  // Check-in hôm nay (đủ trường hành chính để mở hồ sơ lâm sàng ở cột phải).
  const CHECKIN_SELECT = `
    id, slot_start, status, queue_number,
    patient:patient!clinic_patient_id (
      clinic_patient_id, patient_code, full_name, date_of_birth,
      phone_primary, phone_secondary, gender, ethnicity, nationality, occupation,
      patient_objection, address, guardian_name
    ),
    service:service_type!service_type_id ( name )
  `;

  // 3 ô số + ca trực hôm nay + roster tuần + lịch hẹn tuần + check-in hôm nay.
  const [
    taskRes,
    newPatientRes,
    pendingApptRes,
    rosterRes,
    weekApptRes,
    checkinRes,
  ] = await Promise.all([
    supabase
      .from("staff_task")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("patient")
      .select("*", { count: "exact", head: true })
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("appointment")
      .select("*", { count: "exact", head: true })
      .eq("status", "SCHEDULED")
      .gte("slot_start", dayStart)
      .lt("slot_start", dayEnd),
    supabase
      .from("work_roster")
      .select("work_date, station, staff_name, shift")
      .eq("week_start", weekRoster),
    supabase
      .from("appointment")
      .select(WEEK_APPT_SELECT)
      .gte("slot_start", apptStartUtc)
      .lt("slot_start", apptEndUtc)
      .order("slot_start", { ascending: true })
      .limit(500),
    showCheckin
      ? supabase
          .from("appointment")
          .select(CHECKIN_SELECT)
          .gte("slot_start", dayStart)
          .lt("slot_start", dayEnd)
          // GIỮ luôn BN đã CHECKED_IN + đã COMPLETED — không xoá khỏi danh sách
          // sau khi check-in / khám xong, để lễ tân thấy ai đã đến cả ngày.
          .in("status", [
            "SCHEDULED",
            "CSKH_CONFIRMED",
            "CONFIRMED",
            "CHECKED_IN",
            "COMPLETED",
          ])
          .order("slot_start", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] }),
  ]);
  const checkinRows = (checkinRes.data as HomeCheckinRow[] | null) ?? [];

  const cards = [
    { label: "Việc đang chờ làm", value: taskRes.count ?? 0 },
    { label: "BN mới đăng ký hôm nay", value: newPatientRes.count ?? 0 },
    { label: "Lịch chờ xác nhận", value: pendingApptRes.count ?? 0 },
  ];
  // Gom lịch hẹn theo ngày (tuần này) cho bảng "Lịch hẹn khám".
  const rosterRows = (rosterRes.data as RosterRow[] | null) ?? [];
  type RawAppt = Omit<WeekApptRow, "phan_loai">;
  const weekApptRows = (weekApptRes.data as RawAppt[] | null) ?? [];

  // "Phân loại khám" (Tái khám / Khám lần đầu) — suy từ lịch hẹn: BN có lịch hẹn
  // nào SỚM HƠN lịch này → Tái khám; nếu đây là lịch sớm nhất của BN → Khám lần
  // đầu. (DB chưa có cột phân loại riêng; đây là suy luận, không phải bịa số.)
  const patientIds = [
    ...new Set(
      weekApptRows
        .map((a) => a.patient?.clinic_patient_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const earliestByPatient = new Map<string, number>();
  if (patientIds.length) {
    const { data: prior } = await supabase
      .from("appointment")
      .select("clinic_patient_id, slot_start")
      .in("clinic_patient_id", patientIds);
    for (const r of (prior as
      | { clinic_patient_id: string; slot_start: string }[]
      | null) ?? []) {
      const t = new Date(r.slot_start).getTime();
      const cur = earliestByPatient.get(r.clinic_patient_id);
      if (cur === undefined || t < cur)
        earliestByPatient.set(r.clinic_patient_id, t);
    }
  }
  const phanLoaiOf = (a: RawAppt): string => {
    const pid = a.patient?.clinic_patient_id;
    if (!pid) return "";
    const earliest = earliestByPatient.get(pid);
    if (earliest === undefined) return "";
    return new Date(a.slot_start).getTime() > earliest
      ? "Tái khám"
      : "Khám lần đầu";
  };

  const t0 = new Date(apptStartUtc).getTime();
  const apptDays: ApptDay[] = apptDates.map((date, i) => {
    const s = t0 + i * DAY_MS;
    const e = s + DAY_MS;
    const items = weekApptRows
      .filter((a) => {
        const t = new Date(a.slot_start).getTime();
        return t >= s && t < e;
      })
      .map((a) => ({ ...a, phan_loai: phanLoaiOf(a) }));
    return { date, items };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">
          {greet(role, staff)}
        </h1>
        <p className="text-sm text-[#888888]">Hôm nay · {fmtDate(new Date())}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>

      {/* Check-in bệnh nhân — TRÊN Lịch hẹn khám (ĐD/Lễ tân/Quản lý).
          Bấm mở danh sách ngay dưới nút; Lịch hẹn khám tự đẩy xuống. */}
      {showCheckin && (
        <HomeCheckin rows={checkinRows} staffId={staffId} />
      )}

      {/* Lịch hẹn khám — nút tuần RIÊNG (weekAppt), KHÔNG đụng Lịch làm việc. */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#171717]">
            Lịch hẹn khám (check đặt lịch)
          </h2>
          <WeekNav
            week={weekAppt}
            basePath="/home"
            param="weekAppt"
            others={{ weekRoster }}
          />
        </div>
        <WeeklyAppointmentsTable days={apptDays} />
      </section>

      {/* Lịch làm việc — nút tuần RIÊNG (weekRoster), KHÔNG đụng Lịch hẹn khám. */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#171717]">Lịch làm việc</h2>
          <WeekNav
            week={weekRoster}
            basePath="/home"
            param="weekRoster"
            others={{ weekAppt }}
          />
        </div>
        <WorkRosterTable dates={rosterDates} rows={rosterRows} />
      </section>

      {/*
        ===== TẠM ẨN: "Lối tắt" cũ (giữ lại để dùng sau, đừng xoá) =====
        Lối tắt = các mục nav vai trò được phép, dạng nút lớn:

        const actions = NAV.filter(n => n.href !== "/home" && canSeeNav(role, n.href));
        <section>
          <h2>Lối tắt</h2>
          <div className="grid grid-cols-2 ... lg:grid-cols-4">
            {actions.map(({ href, label, icon: Icon }) => (
              <Link href={href} ...><Icon/> {label}</Link>
            ))}
          </div>
        </section>
        (cần import lại: NAV từ "../nav-items", canSeeNav từ "../../../lib/roles")
      */}
    </div>
  );
}
