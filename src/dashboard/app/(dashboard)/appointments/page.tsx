// Appointments dashboard: two tabs switched via ?tab=pending|confirmed.
// Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
// PER-DOCTOR SCOPE: ?scope=me filters to the logged-in doctor's
// appointments when applicable; falls back to "all" otherwise.

import Link from "next/link";
import AppointmentsList from "./AppointmentsList";
import AppointmentsRealtime from "./AppointmentsRealtime";
import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getActiveStaff } from "../../../lib/clinic-session";
import { isDoctorRole } from "../../../lib/roles";
import { vnTodayRangeUtc } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "confirmed", label: "Đã xác nhận" },
  { key: "declined", label: "Đã từ chối" },
] as const;

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN"];
const CONFIRMED_STATUSES = ["CONFIRMED", "CHECKED_IN"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scope?: string }>;
}) {
  const { tab: rawTab, scope: rawScope } = await searchParams;
  const tab =
    rawTab === "confirmed"
      ? "confirmed"
      : rawTab === "declined"
        ? "declined"
        : "pending";

  const role = await getClinicRole();
  const staff = await getActiveStaff();
  const canSwitchScope = isDoctorRole(role);
  const scope = canSwitchScope && rawScope === "me" ? "me" : "all";

  const supabase = await getSupabaseServer();
  // Today's window in Vietnam time (the server runs in UTC).
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // Count-only queries (head: true), all scoped to today's slot_start.
  // When scope === "me" we apply ``doctor_id = staff.id`` to each.
  const applyScope = <T extends { eq: (col: string, val: string) => T }>(q: T): T =>
    scope === "me" && staff ? q.eq("doctor_id", staff.id) : q;

  const [todayRes, pendingRes, confirmedRes] = await Promise.all([
    applyScope(
      supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .gte("slot_start", dayStart)
        .lt("slot_start", dayEnd),
    ),
    applyScope(
      supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("status", "SCHEDULED")
        .gte("slot_start", dayStart)
        .lt("slot_start", dayEnd),
    ),
    applyScope(
      supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .in("status", CONFIRMED_STATUSES)
        .gte("slot_start", dayStart)
        .lt("slot_start", dayEnd),
    ),
  ]);

  const tabHref = (key: string): string =>
    `/appointments?tab=${key}${scope === "me" ? "&scope=me" : ""}`;
  const scopeHref = (s: "all" | "me"): string =>
    `/appointments?tab=${tab}${s === "me" ? "&scope=me" : ""}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#171717]">
            Lịch hẹn{scope === "me" && staff ? ` của ${staff.short_name ?? staff.full_name}` : ""}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-[#888888]">
              Lịch hẹn hôm nay. Read-only.
            </p>
            <AppointmentsRealtime />
          </div>
        </div>
        {canSwitchScope && (
          <div className="flex gap-1" role="group" aria-label="Phạm vi lịch">
            <Link
              href={scopeHref("all")}
              className={
                scope === "all"
                  ? "rounded-md bg-[#171717] px-3.5 py-1.5 text-xs font-medium text-white"
                  : "rounded-md border border-[#e4e4e7] px-3.5 py-1.5 text-xs text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#171717]"
              }
            >
              Tất cả
            </Link>
            <Link
              href={scopeHref("me")}
              className={
                scope === "me"
                  ? "rounded-md bg-[#171717] px-3.5 py-1.5 text-xs font-medium text-white"
                  : "rounded-md border border-[#e4e4e7] px-3.5 py-1.5 text-xs text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#171717]"
              }
            >
              Của tôi
            </Link>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Lịch hẹn hôm nay" value={todayRes.count ?? 0} />
        <StatCard label="Đang chờ" value={pendingRes.count ?? 0} />
        <StatCard label="Đã xác nhận" value={confirmedRes.count ?? 0} />
      </div>

      {/* Segmented control: full-width on mobile (no horizontal swipe),
          auto-width pills on ≥sm. */}
      <nav className="grid grid-cols-3 gap-1 rounded-lg bg-[#f4f4f5] p-1 sm:inline-grid sm:auto-cols-max sm:grid-flow-col sm:bg-transparent sm:p-0">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={
                active
                  ? "rounded-md bg-white px-3 py-2 text-center text-sm font-medium text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.08)] sm:bg-[#171717] sm:py-1.5 sm:text-white sm:shadow-none"
                  : "rounded-md px-3 py-2 text-center text-sm text-[#71717a] transition-colors duration-150 active:bg-white/60 sm:border sm:border-[#e4e4e7] sm:py-1.5 sm:hover:bg-[#f4f4f5] sm:hover:text-[#171717]"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <AppointmentsList tab={tab} scope={scope} />
    </div>
  );
}
