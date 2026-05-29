// Appointments dashboard: two tabs switched via ?tab=pending|confirmed.
// Read-only. CCCD KHÔNG hiển thị (bảo mật D-identity).
// PER-DOCTOR SCOPE: ?scope=me filters to the logged-in doctor's
// appointments when applicable; falls back to "all" otherwise.

import Link from "next/link";
import AppointmentsList from "./AppointmentsList";
import StatCard from "../StatCard";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getCurrentStaff, isDoctorRole } from "../../../lib/current-staff";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "confirmed", label: "Đã xác nhận" },
] as const;

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN"];
const CONFIRMED_STATUSES = ["CONFIRMED", "CHECKED_IN"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scope?: string }>;
}) {
  const { tab: rawTab, scope: rawScope } = await searchParams;
  const tab = rawTab === "confirmed" ? "confirmed" : "pending";

  const staff = await getCurrentStaff();
  const canSwitchScope = isDoctorRole(staff);
  const scope = canSwitchScope && rawScope === "me" ? "me" : "all";

  const supabase = await getSupabaseServer();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const dayStart = startOfDay.toISOString();
  const dayEnd = endOfDay.toISOString();

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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#171717]">
            Lịch hẹn{scope === "me" && staff ? ` của ${staff.short_name ?? staff.full_name}` : ""}
          </h1>
          <p className="text-sm text-[#888888]">Lịch hẹn hôm nay. Read-only.</p>
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

      <nav className="flex gap-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={
                active
                  ? "rounded-md bg-[#171717] px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-md border border-[#e4e4e7] px-3.5 py-1.5 text-sm text-[#71717a] transition-colors duration-150 hover:bg-[#f4f4f5] hover:text-[#171717]"
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
