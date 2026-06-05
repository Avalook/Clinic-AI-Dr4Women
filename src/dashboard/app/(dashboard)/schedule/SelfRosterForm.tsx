"use client";

// "Đăng ký ca của tôi" — cho bác sĩ / lễ tân / điều dưỡng tự thêm/xoá ca CỦA
// MÌNH (feedback C4). KHÔNG có ô chọn nhân viên (server ép staff_id = chính mình)
// và KHÔNG có ô chọn VỊ TRÍ — trạm tự suy từ vai trò (ai đăng ký là người đó làm).
// Ghi qua /api/roster rồi router.refresh() để nạp lại từ server.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { INPUT, LABEL, BTN } from "../form-ui";
import {
  STATION_LABEL,
  SHIFTS,
  SHIFT_LABEL,
  dayShort,
  fmtDayMonth,
  type Shift,
} from "../../../lib/roster";

export interface MyRosterRow {
  id: string;
  work_date: string;
  station: string;
  shift: Shift;
}

export default function SelfRosterForm({
  weekStart,
  dates,
  myRows,
  defaultStation,
}: {
  weekStart: string;
  dates: string[];
  myRows: MyRosterRow[];
  /** Trạm tự suy từ vai trò người đăng nhập (đã bỏ ô chọn vị trí). */
  defaultStation: string;
}) {
  const router = useRouter();
  const [workDate, setWorkDate] = useState(dates[0]);
  const [shift, setShift] = useState<Shift>("FULL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week_start: weekStart,
        work_date: workDate,
        station: defaultStation,
        shift,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Lỗi khi thêm.");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch("/api/roster", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h2 className="mb-3 text-sm font-semibold text-[#171717]">
        Đăng ký ca của tôi
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Ngày</label>
          <select
            className={INPUT}
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {dayShort(d)} · {fmtDayMonth(d)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Ca</label>
          <select
            className={INPUT}
            value={shift}
            onChange={(e) => setShift(e.target.value as Shift)}
          >
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {SHIFT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error}
        </p>
      )}
      <div className="mt-3">
        <button onClick={add} disabled={busy} className={BTN}>
          {busy ? "Đang lưu..." : "+ Đăng ký ca"}
        </button>
      </div>

      {myRows.length > 0 && (
        <ul className="mt-4 divide-y divide-[#f4f4f5] border-t border-[#f4f4f5] pt-2">
          {myRows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 py-1.5 text-sm"
            >
              <span className="min-w-0 text-[#4d4d4d]">
                <span className="font-medium text-[#171717]">
                  {dayShort(r.work_date)} · {fmtDayMonth(r.work_date)}
                </span>{" "}
                · {STATION_LABEL[r.station] ?? r.station}
                {r.shift !== "FULL" && (
                  <span className="text-[#a1a1aa]"> ({SHIFT_LABEL[r.shift]})</span>
                )}
              </span>
              <button
                onClick={() => remove(r.id)}
                disabled={busy}
                aria-label="Xoá"
                className="shrink-0 rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#fee2e2] hover:text-[#dc2626] disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
