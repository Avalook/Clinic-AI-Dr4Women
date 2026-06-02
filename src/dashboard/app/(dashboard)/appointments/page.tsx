// Appointments page — two Kanban boards ("Hôm nay" / "Sắp tới"), each with
// three status columns: Chờ xác nhận → Đã xác nhận → Đã từ chối.
// Read-only data; CCCD is never shown (D-identity gate).
// PER-DOCTOR SCOPE: ?scope=me narrows to the logged-in doctor's appointments.

import Link from "next/link";
import AppointmentsKanban, {
  KANBAN_SELECT,
  type KanbanRow,
} from "./AppointmentsKanban";
import AppointmentsRealtime from "./AppointmentsRealtime";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getActiveStaff } from "../../../lib/clinic-session";
import { isDoctorRole } from "../../../lib/roles";
import { vnTodayRangeUtc } from "../../../lib/datetime";

export const dynamic = "force-dynamic";

// Statuses that belong on the workflow board (history states like COMPLETED /
// NO_SHOW / CANCELLED live in the patient's history, not here).
const BOARD_STATUSES = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "DOCTOR_DECLINED"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: rawScope } = await searchParams;

  const role = await getClinicRole();
  const staff = await getActiveStaff();
  const canSwitchScope = isDoctorRole(role);
  const scope = canSwitchScope && rawScope === "me" ? "me" : "all";
  const meId = scope === "me" && staff ? staff.id : null;

  const supabase = await getSupabaseServer();
  const { startUtc: dayStart, endUtc: dayEnd } = vnTodayRangeUtc();

  // Today + upcoming fetched in parallel (cheap now that the function runs in
  // the same region as Supabase).
  const buildQuery = (which: "today" | "upcoming") => {
    let q = supabase
      .from("appointment")
      .select(KANBAN_SELECT)
      .in("status", BOARD_STATUSES);
    q =
      which === "today"
        ? q.gte("slot_start", dayStart).lt("slot_start", dayEnd)
        : q.gte("slot_start", dayEnd);
    q = q.order("slot_start", { ascending: true }).limit(200);
    if (meId) q = q.eq("doctor_id", meId);
    return q;
  };

  const [todayRes, upcomingRes] = await Promise.all([
    buildQuery("today"),
    buildQuery("upcoming"),
  ]);

  const today = (todayRes.data as KanbanRow[] | null) ?? [];
  const upcoming = (upcomingRes.data as KanbanRow[] | null) ?? [];
  const error = todayRes.error ?? upcomingRes.error;

  const scopeHref = (s: "all" | "me"): string =>
    s === "me" ? "/appointments?scope=me" : "/appointments";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#171717]">
            Lịch hẹn{scope === "me" && staff ? ` của ${staff.short_name ?? staff.full_name}` : ""}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-[#888888]">
              Bảng theo dõi xác nhận lịch. Read-only.
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

      {error && (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      )}

      <AppointmentsKanban
        title="Hôm nay"
        rows={today}
        canAct={canSwitchScope}
        staffId={staff?.id ?? null}
      />

      <AppointmentsKanban
        title="Sắp tới"
        rows={upcoming}
        withDate
        canAct={canSwitchScope}
        staffId={staff?.id ?? null}
      />
    </div>
  );
}
