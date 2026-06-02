// Lịch làm việc — KANBAN theo tuần (7 cột = 7 ngày). Mọi vai trò:
//  - Quản lý: thấy tất cả phân công + nút Sửa.
//  - Bác sĩ / điều dưỡng / người khác: chỉ thấy ca trực CỦA MÌNH.
// Hover = nổi thẻ, click = chi tiết. Dữ liệu đọc qua RLS; ghi qua /api/roster.

import Link from "next/link";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isAdminRole } from "../../../lib/roles";
import {
  fmtDayMonth,
  weekDates,
  weekStartOf,
  shiftWeek,
  currentWeekStartVn,
  todayVn,
} from "../../../lib/roster";
import WeekKanban, { type KanbanRosterRow } from "./WeekKanban";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: rawWeek } = await searchParams;
  const week = rawWeek ? weekStartOf(rawWeek) : currentWeekStartVn();
  const dates = weekDates(week);

  const role = await getClinicRole();
  const isAdmin = isAdminRole(role);
  const myStaffId = isAdmin ? null : await getClinicStaffId();

  const supabase = await getSupabaseServer();
  let q = supabase
    .from("work_roster")
    .select("id, work_date, shift, station, staff_id, staff_name")
    .eq("week_start", week)
    .order("sort", { ascending: true });
  // Cá nhân: chỉ lấy phân công của mình.
  if (!isAdmin && myStaffId) q = q.eq("staff_id", myStaffId);
  const { data } = await q;
  const rows = (data as KanbanRosterRow[] | null) ?? [];

  const weekLabel = `${fmtDayMonth(dates[0])} – ${fmtDayMonth(dates[6])}`;
  const navHref = (w: string) => `/schedule?week=${w}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#171717]">Lịch làm việc</h1>
          <p className="text-sm text-[#888888]">
            {isAdmin
              ? "Phân công theo vị trí — click thẻ để xem chi tiết."
              : "Ca trực của bạn trong tuần — click thẻ để xem chi tiết."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href={`/schedule/edit?week=${week}`}
            className="rounded-lg bg-[#ec4899] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#db2777]"
          >
            Sửa lịch
          </Link>
        )}
      </header>

      {/* Điều hướng tuần */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3 py-2">
        <Link
          href={navHref(shiftWeek(week, -1))}
          className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-sm text-[#4d4d4d] transition-colors hover:bg-[#f4f4f5]"
        >
          ← Tuần trước
        </Link>
        <span className="text-sm font-medium text-[#171717]">Tuần {weekLabel}</span>
        <Link
          href={navHref(shiftWeek(week, 1))}
          className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-sm text-[#4d4d4d] transition-colors hover:bg-[#f4f4f5]"
        >
          Tuần sau →
        </Link>
      </div>

      {!isAdmin && rows.length === 0 ? (
        <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-10 text-center text-sm text-[#888888]">
          Tuần này bạn chưa có ca trực.
        </div>
      ) : (
        <WeekKanban
          dates={dates}
          rows={rows}
          todayIso={todayVn()}
          personal={!isAdmin}
        />
      )}
    </div>
  );
}
