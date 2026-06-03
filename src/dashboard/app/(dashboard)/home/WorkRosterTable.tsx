// Bảng "Lịch làm việc" trên trang chủ — form theo file BẢNG LÀM VIỆC: hàng = NGÀY
// (T2..CN của tuần này), cột = TRẠM/vị trí (STATIONS), ô = nhân viên trực. Read-only,
// nhận data từ work_roster (server fetch ở home/page.tsx). Cuộn ngang vì nhiều cột.

import {
  STATIONS,
  dayShort,
  fmtDayMonth,
  SHIFT_LABEL,
  type Shift,
} from "../../../lib/roster";

export interface RosterRow {
  work_date: string;
  station: string;
  staff_name: string | null;
  shift: string;
}

export default function WorkRosterTable({
  dates,
  rows,
}: {
  dates: string[];
  rows: RosterRow[];
}) {
  // byDate[date][station] = danh sách "Tên (· ca)".
  const byDate = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    if (!r.staff_name) continue;
    const dm = byDate.get(r.work_date) ?? new Map<string, string[]>();
    const list = dm.get(r.station) ?? [];
    const suffix = r.shift && r.shift !== "FULL" ? ` · ${SHIFT_LABEL[r.shift as Shift] ?? r.shift}` : "";
    list.push(r.staff_name + suffix);
    dm.set(r.station, list);
    byDate.set(r.work_date, dm);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e4e4e7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <table className="min-w-max border-collapse text-xs">
        <thead>
          <tr className="bg-[#fafafa]">
            <th className="sticky left-0 z-10 border-b border-r border-[#e4e4e7] bg-[#fafafa] px-2 py-2 text-left font-semibold text-[#52525b]">
              Ngày
            </th>
            {STATIONS.map((s) => (
              <th
                key={s.key}
                className="min-w-[88px] border-b border-r border-[#e4e4e7] px-2 py-2 text-left font-semibold text-[#52525b]"
              >
                {s.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => {
            const dm = byDate.get(d);
            return (
              <tr key={d} className="align-top">
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-[#e4e4e7] bg-white px-2 py-2 font-medium text-[#171717]">
                  {dayShort(d)} · {fmtDayMonth(d)}
                </td>
                {STATIONS.map((s) => {
                  const names = dm?.get(s.key) ?? [];
                  return (
                    <td
                      key={s.key}
                      className="border-b border-r border-[#e4e4e7] px-2 py-2 text-[#171717]"
                    >
                      {names.length === 0 ? (
                        <span className="text-[#d4d4d8]">—</span>
                      ) : (
                        names.map((n, i) => (
                          <span key={i} className="block whitespace-nowrap">
                            {n}
                          </span>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
