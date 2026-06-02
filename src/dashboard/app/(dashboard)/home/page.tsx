// Home = bàn làm việc nhanh, role-aware:
//  1. Lời chào + ngày hôm nay
//  2. 3 ô số (role-aware: bác sĩ / CSKH / chung)
//  3. Ca trực hôm nay của bạn (từ work_roster)
//  4. Lối tắt nhanh (các mục nav role được phép → việc hay dùng)

import Link from "next/link";
import StatCard from "../StatCard";
import { NAV } from "../nav-items";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getActiveStaff, getClinicStaffId } from "../../../lib/clinic-session";
import {
  isDoctorRole,
  isAdminRole,
  canSeeNav,
  type ClinicRole,
} from "../../../lib/roles";
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

const ACTIVE_APPT_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN"];

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
  const name = cleanName(staff.short_name ?? staff.full_name);
  return `Chào ${GREET_LABEL[role]} ${name}`;
}

interface StatTriple {
  title: string;
  cards: { label: string; value: number }[];
}

async function buildStats(): Promise<StatTriple> {
  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const staff = await getActiveStaff();
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  if (isDoctorRole(role) && staff) {
    const [appt, visit, task] = await Promise.all([
      supabase.from("appointment").select("*", { count: "exact", head: true })
        .eq("doctor_id", staff.id).in("status", ACTIVE_APPT_STATUSES)
        .gte("slot_start", dayStart).lt("slot_start", dayEnd),
      supabase.from("visit").select("*", { count: "exact", head: true })
        .eq("attending_doctor_id", staff.id).gte("created_at", dayStart).lt("created_at", dayEnd),
      supabase.from("staff_task").select("*", { count: "exact", head: true })
        .eq("assigned_staff_id", staff.id).eq("status", "PENDING"),
    ]);
    return {
      title: greet(role, staff),
      cards: [
        { label: "Lịch hẹn hôm nay (của tôi)", value: appt.count ?? 0 },
        { label: "BN đã khám hôm nay", value: visit.count ?? 0 },
        { label: "Việc đang chờ", value: task.count ?? 0 },
      ],
    };
  }

  if (role === "CSKH") {
    const [task, newPatient, pendingAppt] = await Promise.all([
      supabase.from("staff_task").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase.from("patient").select("*", { count: "exact", head: true })
        .gte("created_at", dayStart).lt("created_at", dayEnd),
      supabase.from("appointment").select("*", { count: "exact", head: true })
        .eq("status", "SCHEDULED").gte("slot_start", dayStart).lt("slot_start", dayEnd),
    ]);
    return {
      title: greet(role, staff),
      cards: [
        { label: "Việc đang chờ làm", value: task.count ?? 0 },
        { label: "BN mới đăng ký hôm nay", value: newPatient.count ?? 0 },
        { label: "Lịch chờ xác nhận", value: pendingAppt.count ?? 0 },
      ],
    };
  }

  const [appt, patient, task] = await Promise.all([
    supabase.from("appointment").select("*", { count: "exact", head: true })
      .in("status", ACTIVE_APPT_STATUSES).gte("slot_start", dayStart).lt("slot_start", dayEnd),
    supabase.from("patient").select("*", { count: "exact", head: true })
      .gte("created_at", dayStart).lt("created_at", dayEnd),
    supabase.from("staff_task").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);
  return {
    title: greet(role, staff),
    cards: [
      { label: "Lịch hẹn hôm nay", value: appt.count ?? 0 },
      { label: "BN mới đăng ký hôm nay", value: patient.count ?? 0 },
      { label: "Việc đang chờ", value: task.count ?? 0 },
    ],
  };
}

interface TodayShift {
  id: string;
  station: string;
  shift: Shift;
}

export default async function HomePage() {
  const role = await getClinicRole();
  const isAdmin = isAdminRole(role);
  const stats = await buildStats();

  // Ca trực hôm nay của chính người dùng (trừ quản lý — họ xem cả bảng riêng).
  let todayShifts: TodayShift[] = [];
  const staffId = isAdmin ? null : await getClinicStaffId();
  if (staffId) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase
      .from("work_roster")
      .select("id, station, shift")
      .eq("staff_id", staffId)
      .eq("work_date", todayVn());
    todayShifts = (data as TodayShift[] | null) ?? [];
  }

  // Lối tắt: các mục nav vai trò được phép (bỏ /home).
  const actions = NAV.filter(
    (n) => n.href !== "/home" && canSeeNav(role, n.href),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">{stats.title}</h1>
        <p className="text-sm text-[#888888]">Hôm nay · {fmtDate(new Date())}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>

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
                const color = GROUP_COLOR[STATION_GROUP[s.station] ?? ""] ?? "#71717a";
                return (
                  <span
                    key={s.id}
                    style={{ borderLeftColor: color }}
                    className="rounded-lg border border-l-4 border-[#e4e4e7] bg-white px-3 py-1.5 text-sm text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    {STATION_SHORT[s.station] ?? s.station}
                    {s.shift !== "FULL" && (
                      <span className="text-[#888888]"> · {SHIFT_LABEL[s.shift]}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#171717]">Lối tắt</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#ec4899] hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fce7f3] text-[#db2777]">
                <Icon size={18} />
              </span>
              <span className="text-sm font-medium text-[#171717]">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
