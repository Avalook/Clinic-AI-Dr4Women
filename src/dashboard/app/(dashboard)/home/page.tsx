// Home page: 3 role-aware StatCards. The actual landing destination is
// chosen per-role at proxy time (see proxy.ts → roleLanding); this page
// is the default fallback for MANAGEMENT / unlinked accounts, and is
// reachable by any role via the nav "Trang chủ" item.
//
// Doctors see today's own appointments + today's own clinical records.
// CSKH sees the open task queue + newly-registered patients today.
// Anyone else (incl. Admin) sees workspace totals for today.

import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getActiveStaff } from "../../../lib/clinic-session";
import { isDoctorRole, ROLE_LABEL } from "../../../lib/roles";
import { vnTodayRangeUtc } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

// Status that counts as "active" for today's appointments. Mirrors the
// /appointments page's ACTIVE_STATUSES so the numbers line up.
const ACTIVE_APPT_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN"];

interface StatTriple {
  title: string;
  subtitle: string;
  cards: { label: string; value: number }[];
}

async function buildStats(): Promise<StatTriple> {
  const supabase = await getSupabaseServer();
  const role = await getClinicRole();
  const staff = await getActiveStaff();

  // Today's window in Vietnam time (the server runs in UTC).
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // ----- DOCTOR view: "lịch của tôi + BN khám hôm nay + task pending" -----
  if (isDoctorRole(role) && staff) {
    const [appt, visit, task] = await Promise.all([
      supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", staff.id)
        .in("status", ACTIVE_APPT_STATUSES)
        .gte("slot_start", dayStart)
        .lt("slot_start", dayEnd),
      supabase
        .from("visit")
        .select("*", { count: "exact", head: true })
        .eq("attending_doctor_id", staff.id)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd),
      supabase
        .from("staff_task")
        .select("*", { count: "exact", head: true })
        .eq("assigned_staff_id", staff.id)
        .eq("status", "PENDING"),
    ]);
    return {
      title: `Chào ${staff.short_name ?? staff.full_name}`,
      subtitle: "Hôm nay của bạn",
      cards: [
        { label: "Lịch hẹn hôm nay (của tôi)", value: appt.count ?? 0 },
        { label: "BN đã khám hôm nay", value: visit.count ?? 0 },
        { label: "Việc đang chờ", value: task.count ?? 0 },
      ],
    };
  }

  // ----- CSKH view: "task queue + BN mới hôm nay + lịch chờ confirm" -----
  if (role === "CSKH") {
    const [task, newPatient, pendingAppt] = await Promise.all([
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
    ]);
    return {
      title: "Chào CSKH",
      subtitle: "Hôm nay",
      cards: [
        { label: "Việc đang chờ làm", value: task.count ?? 0 },
        { label: "BN mới đăng ký hôm nay", value: newPatient.count ?? 0 },
        { label: "Lịch chờ xác nhận", value: pendingAppt.count ?? 0 },
      ],
    };
  }

  // ----- Fallback (Admin / unlinked / RECEPTION / NURSE): workspace -----
  const [appt, patient, task] = await Promise.all([
    supabase
      .from("appointment")
      .select("*", { count: "exact", head: true })
      .in("status", ACTIVE_APPT_STATUSES)
      .gte("slot_start", dayStart)
      .lt("slot_start", dayEnd),
    supabase
      .from("patient")
      .select("*", { count: "exact", head: true })
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("staff_task")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);
  return {
    title: role ? `Chào ${ROLE_LABEL[role]}` : "Trang chủ",
    subtitle: "Tổng quan hôm nay",
    cards: [
      { label: "Lịch hẹn hôm nay", value: appt.count ?? 0 },
      { label: "BN mới đăng ký hôm nay", value: patient.count ?? 0 },
      { label: "Việc đang chờ", value: task.count ?? 0 },
    ],
  };
}

export default async function HomePage() {
  const stats = await buildStats();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">{stats.title}</h1>
        <p className="text-sm text-[#888888]">{stats.subtitle}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
    </div>
  );
}
