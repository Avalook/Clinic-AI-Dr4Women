// Điều hướng TUẦN (← tuần trước · tuần này · tuần sau →) — dùng cho 2 bảng trang
// chủ (Lịch hẹn khám + Lịch làm việc) để xem cả quá khứ lẫn tương lai. Chỉ là các
// Link đổi ?week=… nên là Server Component (không cần "use client").

import Link from "next/link";
import {
  shiftWeek,
  weekDates,
  fmtDayMonth,
  currentWeekStartVn,
} from "../../lib/roster";

const BTN =
  "rounded-md border border-[#f3cfe0] px-2.5 py-1 text-xs font-medium text-[#9d2463] transition-colors hover:bg-[#fdf2f8]";

export default function WeekNav({
  week,
  basePath,
}: {
  week: string;
  basePath: string;
}) {
  const dates = weekDates(week);
  const label = `${fmtDayMonth(dates[0])} – ${fmtDayMonth(dates[6])}`;
  const cur = currentWeekStartVn();
  const href = (w: string) => `${basePath}?week=${w}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(shiftWeek(week, -1))} className={BTN}>
        ← Tuần trước
      </Link>
      <span className="text-xs font-medium text-[#171717]">
        Tuần {label}
        {week === cur && <span className="text-[#c084a8]"> · tuần này</span>}
      </span>
      <Link href={href(shiftWeek(week, 1))} className={BTN}>
        Tuần sau →
      </Link>
      {week !== cur && (
        <Link href={href(cur)} className={BTN}>
          Về tuần này
        </Link>
      )}
    </div>
  );
}
