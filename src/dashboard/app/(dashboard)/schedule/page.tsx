// Lịch làm việc (weekly roster).
//  - Quản lý: xem toàn bộ bảng (lưới ngày × trạm) + nút sửa.
//  - Bác sĩ / người đã chọn tên: chỉ xem ca trực CỦA MÌNH trong tuần.
//  - Vai trò khác chưa chọn tên: hiện ô "Bạn là ai?" để chọn.
// Dữ liệu đọc qua RLS (SELECT cho authenticated); ghi qua /api/roster (admin).

import Link from "next/link";
import { cookies } from "next/headers";
import { getSupabaseServer } from "../../../lib/supabase-server";
import { getClinicRole, getClinicStaffId } from "../../../lib/clinic-session";
import { isAdminRole, isDoctorRole } from "../../../lib/roles";
import {
  STATIONS,
  STATION_LABEL,
  SHIFT_LABEL,
  type Shift,
  dayShort,
  dayLabel,
  fmtDayMonth,
  weekDates,
  weekStartOf,
  shiftWeek,
  currentWeekStartVn,
  ROSTER_STAFF_COOKIE,
} from "../../../lib/roster";
import PersonPicker, { type StaffOpt } from "./PersonPicker";

export const dynamic = "force-dynamic";

interface RosterRow {
  id: string;
  work_date: string;
  shift: Shift;
  station: string;
  staff_id: string | null;
  staff_name: string;
}

function shiftTag(s: Shift): string {
  return s === "FULL" ? "" : ` (${SHIFT_LABEL[s]})`;
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

  // Danh tính để lọc "lịch của tôi".
  let myStaffId: string | null = null;
  if (isDoctorRole(role)) {
    myStaffId = await getClinicStaffId();
  } else if (!isAdmin) {
    myStaffId = (await cookies()).get(ROSTER_STAFF_COOKIE)?.value ?? null;
  }

  const supabase = await getSupabaseServer();
  const [rosterRes, staffRes] = await Promise.all([
    supabase
      .from("work_roster")
      .select("id, work_date, shift, station, staff_id, staff_name")
      .eq("week_start", week)
      .order("work_date", { ascending: true })
      .order("sort", { ascending: true }),
    // Staff cho person-picker (vai trò non-doctor) + tên hiển thị.
    !isAdmin && !isDoctorRole(role)
      ? supabase
          .from("staff")
          .select("id, full_name, short_name")
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rows = (rosterRes.data as RosterRow[] | null) ?? [];
  const staffOpts: StaffOpt[] = (
    (staffRes.data as { id: string; full_name: string; short_name: string | null }[] | null) ??
    []
  ).map((s) => ({ id: s.id, label: s.short_name ?? s.full_name }));

  const weekLabel = `${fmtDayMonth(dates[0])} – ${fmtDayMonth(dates[6])}`;
  const navHref = (w: string) => `/schedule?week=${w}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[#171717]">Lịch làm việc</h1>
          <p className="text-sm text-[#888888]">
            {isAdmin
              ? "Phân công ca trực theo phòng/trạm. Bấm Sửa để cập nhật."
              : "Ca trực của bạn trong tuần."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href={`/schedule/edit?week=${week}`}
              className="rounded-lg bg-[#ec4899] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#db2777]"
            >
              Sửa lịch
            </Link>
          )}
        </div>
      </header>

      {/* Điều hướng tuần */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3 py-2">
        <Link
          href={navHref(shiftWeek(week, -1))}
          className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-sm text-[#4d4d4d] hover:bg-[#f4f4f5]"
        >
          ← Tuần trước
        </Link>
        <span className="text-sm font-medium text-[#171717]">Tuần {weekLabel}</span>
        <Link
          href={navHref(shiftWeek(week, 1))}
          className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-sm text-[#4d4d4d] hover:bg-[#f4f4f5]"
        >
          Tuần sau →
        </Link>
      </div>

      {isAdmin ? (
        <AdminGrid dates={dates} rows={rows} />
      ) : (
        <PersonalView
          dates={dates}
          rows={rows}
          myStaffId={myStaffId}
          showPicker={!isDoctorRole(role)}
          staffOpts={staffOpts}
        />
      )}
    </div>
  );
}

// ---- Quản lý: lưới đầy đủ (ngày × trạm) ----
function AdminGrid({ dates, rows }: { dates: string[]; rows: RosterRow[] }) {
  const cell = (date: string, station: string) =>
    rows.filter((r) => r.work_date === date && r.station === station);

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-wide text-[#71717a]">
          <tr>
            <th className="sticky left-0 z-10 border-b border-[#e4e4e7] bg-[#fafafa] px-3 py-2 font-medium">
              Ngày
            </th>
            {STATIONS.map((s) => (
              <th
                key={s.key}
                className="min-w-[120px] border-b border-l border-[#e4e4e7] px-3 py-2 font-medium"
              >
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => (
            <tr key={d} className="align-top">
              <td className="sticky left-0 z-10 whitespace-nowrap border-b border-[#f4f4f5] bg-white px-3 py-2 font-medium text-[#171717]">
                {dayShort(d)} {fmtDayMonth(d)}
              </td>
              {STATIONS.map((s) => {
                const items = cell(d, s.key);
                return (
                  <td
                    key={s.key}
                    className="border-b border-l border-[#f4f4f5] px-3 py-2 text-[#4d4d4d]"
                  >
                    {items.length === 0 ? (
                      <span className="text-[#d4d4d8]">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {items.map((it) => (
                          <div key={it.id}>
                            {it.staff_name}
                            <span className="text-[#a1a1aa]">
                              {shiftTag(it.shift)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Cá nhân: chỉ ca trực của mình ----
function PersonalView({
  dates,
  rows,
  myStaffId,
  showPicker,
  staffOpts,
}: {
  dates: string[];
  rows: RosterRow[];
  myStaffId: string | null;
  showPicker: boolean;
  staffOpts: StaffOpt[];
}) {
  if (!myStaffId && showPicker) {
    return <PersonPicker staff={staffOpts} current={null} />;
  }

  const mine = rows.filter((r) => myStaffId && r.staff_id === myStaffId);
  const byDate = dates
    .map((d) => ({ date: d, items: mine.filter((r) => r.work_date === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      {showPicker && (
        <PersonPicker staff={staffOpts} current={myStaffId} />
      )}

      {byDate.length === 0 ? (
        <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-10 text-center text-sm text-[#888888]">
          Tuần này bạn chưa có ca trực.
        </div>
      ) : (
        <div className="space-y-2">
          {byDate.map((g) => (
            <div
              key={g.date}
              className="rounded-lg border border-[#e4e4e7] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <p className="mb-2 text-sm font-semibold text-[#171717]">
                {dayLabel(g.date)} · {fmtDayMonth(g.date)}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <span
                    key={it.id}
                    className="rounded-full bg-[#fce7f3] px-3 py-1 text-xs font-medium text-[#9d174d]"
                  >
                    {STATION_LABEL[it.station] ?? it.station}
                    {shiftTag(it.shift)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
