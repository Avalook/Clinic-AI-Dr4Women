"use client";

// Trình bày THUẦN (đọc data đã có) cho board "Trạng thái BN buổi khám" của Lễ tân:
//   - ProgressStepper: thanh tiến trình ngang map visit.status qua các mốc.
//   - WaitClock: chip đếm thời gian chờ kể từ check-in, ĐỔI MÀU theo ngưỡng.
// KHÔNG ghi DB, KHÔNG đụng enum/visit.status — chỉ render từ props.

import { useEffect, useState } from "react";

// ── Ngưỡng đổi màu đồng hồ chờ (PHÚT kể từ check-in) — cấu hình DUY NHẤT ở đây ──
const WAIT_GREEN_MAX = 10; // < 10p  → xanh
const WAIT_YELLOW_MAX = 20; // 10–20p → vàng;  > 20p → đỏ

// Các mốc tiến trình 1 buổi khám. backed=false → CHƯA có nguồn data → render XÁM.
//   Hẹn/Xác nhận/Check-in: ngầm ĐÃ QUA (visit chỉ tồn tại sau khi check-in).
//   Đang khám: visit.status = IN_PROGRESS. Xong(lâm sàng): FINALIZED/AMENDED.
//   Chờ SA/XN: board chưa join sono/lab. Chờ thanh toán/Xong: chờ vertical billing.
const STEPS: { key: string; label: string; backed: boolean; note?: string }[] = [
  { key: "hen", label: "Hẹn", backed: true },
  { key: "xac_nhan", label: "Xác nhận", backed: true },
  { key: "checkin", label: "Check-in", backed: true },
  { key: "dang_kham", label: "Đang khám", backed: true },
  { key: "cho_cls", label: "Chờ SA/XN", backed: false, note: "chưa nối hàng đợi sono/lab" },
  { key: "cho_tt", label: "Chờ thanh toán", backed: false, note: "chờ billing (thu ngân)" },
  { key: "xong", label: "Xong", backed: false, note: "chờ billing (thu ngân)" },
];

// visit.status → index mốc backed CAO NHẤT đã đạt.
function reachedIndex(status: string): number {
  switch (status) {
    case "IN_PROGRESS":
    case "FINALIZED":
    case "AMENDED":
      return 3; // đang/đã khám
    case "OPEN":
    default:
      return 2; // đã check-in, đang chờ bác sĩ
  }
}

export function ProgressStepper({ status }: { status: string }) {
  const reached = reachedIndex(status);
  const clinicalDone = status === "FINALIZED" || status === "AMENDED";

  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        let state: "done" | "current" | "upcoming" | "disabled";
        if (!s.backed) state = "disabled";
        else if (i < reached) state = "done";
        else if (i === reached) state = clinicalDone ? "done" : "current";
        else state = "upcoming";

        const dot =
          state === "done"
            ? "bg-[#ec4899] border-[#ec4899]"
            : state === "current"
              ? "bg-white border-[#ec4899] ring-2 ring-[#ec4899]/30"
              : state === "upcoming"
                ? "bg-white border-[#f3cfe0]"
                : "bg-[#f4f4f5] border-[#e4e4e7] border-dashed";
        const txt =
          state === "done"
            ? "text-[#9d2463]"
            : state === "current"
              ? "text-[#ec4899] font-semibold"
              : state === "disabled"
                ? "text-[#c4c4c8]"
                : "text-[#a1a1aa]";

        return (
          <div key={s.key} className="flex items-center">
            <div
              className="flex flex-col items-center gap-0.5"
              title={state === "disabled" ? `${s.label} — ${s.note}` : s.label}
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${dot}`} />
              <span className={`whitespace-nowrap text-[9px] leading-none ${txt}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-0.5 mb-3 h-px w-4 ${i < reached ? "bg-[#ec4899]" : "bg-[#e4e4e7]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WaitClock({
  checkedInAt,
  active,
}: {
  /** visit.checked_in_at — mốc bắt đầu đếm. */
  checkedInAt: string | null;
  /** Chỉ đếm khi BN đang chờ/đang khám (OPEN/IN_PROGRESS). Đã xong → ngừng. */
  active: boolean;
}) {
  // null cho tới khi mount ở client → tránh hydration mismatch (server không có "now").
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!checkedInAt || !active) return;
    const tick = () => setNowMs(Date.now());
    // tick đầu qua setTimeout(0) (callback, không phải thân effect) để tránh
    // setState đồng bộ trong effect; interval lo các tick sau.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id); // cleanup khi unmount / đổi props
    };
  }, [checkedInAt, active]);

  if (!checkedInAt) return <span className="text-[11px] text-[#c4c4c8]">—</span>;
  if (!active) return <span className="text-[11px] text-[#a1a1aa]">—</span>;
  if (nowMs === null) return <span className="text-[11px] text-[#a1a1aa]">…</span>;

  const totalSec = Math.max(0, Math.floor((nowMs - new Date(checkedInAt).getTime()) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const cls =
    min < WAIT_GREEN_MAX
      ? "bg-[#dcfce7] text-[#15803d]"
      : min < WAIT_YELLOW_MAX
        ? "bg-[#fef9c3] text-[#a16207]"
        : "bg-[#fee2e2] text-[#dc2626]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${cls}`}
      title={`Chờ ${min} phút kể từ check-in`}
    >
      ⏱ {min}:{String(sec).padStart(2, "0")}
    </span>
  );
}
