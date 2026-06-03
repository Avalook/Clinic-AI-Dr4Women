// Trang chủ — ĐỒNG BỘ cho mọi vai trò. Giữ ĐÚNG 4 khối:
//  1. Lời chào (chức danh + tên) + ngày hôm nay
//  2. 3 ô số: Việc đang chờ làm · BN mới đăng ký hôm nay · Lịch chờ xác nhận
//  3. Ca trực hôm nay của bạn (từ work_roster)
//
// (Khối "2 mục" Lịch hẹn/Lịch làm việc + "Lối tắt" cũ đã bỏ/ẩn theo yêu cầu —
//  comment "Lối tắt" giữ ở cuối file để dùng lại nếu cần.)

import Link from "next/link";
import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import {
  getClinicRole,
  getActiveStaff,
  getClinicStaffId,
} from "../../../lib/clinic-session";
import { type ClinicRole } from "../../../lib/roles";
import type { ActiveStaff } from "../../../lib/clinic-session";
import { vnTodayRangeUtc, fmtDate } from "../../../lib/datetime";
import {
  STATION_SHORT,
  STATION_GROUP,
  GROUP_COLOR,
  SHIFT_LABEL,
  todayVn,
  type Shift,
} from "../../../lib/roster";

export const dynamic = "force-dynamic";

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

interface TodayShift {
  id: string;
  station: string;
  shift: Shift;
}

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const staff = await getActiveStaff();
  const staffId = await getClinicStaffId();
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // 3 ô số — chung cho mọi vai trò.
  const [taskRes, newPatientRes, pendingApptRes, shiftRes] = await Promise.all([
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
    staffId
      ? supabase
          .from("work_roster")
          .select("id, station, shift")
          .eq("staff_id", staffId)
          .eq("work_date", todayVn())
      : Promise.resolve({ data: [] }),
  ]);

  const cards = [
    { label: "Việc đang chờ làm", value: taskRes.count ?? 0 },
    { label: "BN mới đăng ký hôm nay", value: newPatientRes.count ?? 0 },
    { label: "Lịch chờ xác nhận", value: pendingApptRes.count ?? 0 },
  ];
  const todayShifts = (shiftRes.data as TodayShift[] | null) ?? [];

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

      {/* Ca trực hôm nay của bạn */}
      {staffId && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#171717]">
            Ca trực hôm nay của bạn
          </h2>
          {todayShifts.length === 0 ? (
            <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-4 text-sm text-[#888888]">
              Hôm nay bạn không có ca trực.{" "}
              <Link href="/schedule" className="text-[#ec4899] hover:underline">
                Xem cả tuần →
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {todayShifts.map((s) => {
                const color =
                  GROUP_COLOR[STATION_GROUP[s.station] ?? ""] ?? "#71717a";
                return (
                  <span
                    key={s.id}
                    style={{ borderLeftColor: color }}
                    className="rounded-lg border border-l-4 border-[#e4e4e7] bg-white px-3 py-1.5 text-sm text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    {STATION_SHORT[s.station] ?? s.station}
                    {s.shift !== "FULL" && (
                      <span className="text-[#888888]">
                        {" "}
                        · {SHIFT_LABEL[s.shift]}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      )}

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
