// Lịch làm việc — BẢNG MA TRẬN tuần (đồng bộ form ở mọi vai trò: cùng layout
// với "Lịch làm việc · tuần này" trên Trang chủ — ngày × trạm, gom theo tầng).
//  - Quản lý: thấy tất cả phân công + nút "Sửa lịch" → /schedule/edit.
//  - Bác sĩ / điều dưỡng / lễ tân / CSKH: thấy bảng đầy đủ (tham khảo cả phòng
//    khám) + form "Đăng ký ca của tôi" ở trên.
// Read-only; ghi qua /api/roster (form đăng ký) hoặc /schedule/edit (quản lý).

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
  defaultStationForRole,
} from "../../../lib/roster";
import WorkRosterTable, {
  type RosterRow,
} from "../home/WorkRosterTable";
import SelfRosterForm from "./SelfRosterForm";

export const dynamic = "force-dynamic";

// Row kèm id để SelfRosterForm xoá được đúng ca (RosterRow của bảng không có id).
interface RosterRowWithId extends RosterRow {
  id: string;
  staff_id: string | null;
}

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

  // Lấy TOÀN BỘ phân công của tuần (cho mọi vai trò) → bảng ma trận đồng bộ với
  // trang chủ. Form "Đăng ký ca của tôi" lọc client-side theo staff_id.
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("work_roster")
    .select("id, work_date, shift, station, staff_id, staff_name")
    .eq("week_start", week)
    .order("sort", { ascending: true });
  const rows = (data as RosterRowWithId[] | null) ?? [];
  const myRows = myStaffId
    ? rows.filter((r) => r.staff_id === myStaffId)
    : [];

  const weekLabel = `${fmtDayMonth(dates[0])} – ${fmtDayMonth(dates[6])}`;
  const navHref = (w: string) => `/schedule?week=${w}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#171717]">Lịch làm việc</h1>
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

      {/* Bảng ma trận — DÙNG CHUNG với Trang chủ, mọi vai trò thấy giống nhau. */}
      <WorkRosterTable dates={dates} rows={rows} />

      {/* Không phải quản lý: form tự đăng ký ca CỦA MÌNH ở dưới (feedback C4). */}
      {!isAdmin && (
        <SelfRosterForm
          weekStart={week}
          dates={dates}
          defaultStation={defaultStationForRole(role)}
          myRows={myRows.map((r) => ({
            id: r.id,
            work_date: r.work_date,
            station: r.station,
            shift: r.shift as "FULL" | "SANG" | "CHIEU",
          }))}
        />
      )}
    </div>
  );
}
