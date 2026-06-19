"use client";

// Trình bày THUẦN (đọc data đã có) cho board "Trạng thái BN buổi khám" của Lễ tân:
//   - ProgressStepper: thanh tiến trình ngang map visit.status qua các mốc.
//   - WaitClock: chip đếm thời gian chờ kể từ check-in, ĐỔI MÀU theo ngưỡng.
// KHÔNG ghi DB, KHÔNG đụng enum/visit.status — chỉ render từ props.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// ── Ngưỡng đổi màu đồng hồ chờ (PHÚT kể từ check-in) — cấu hình DUY NHẤT ở đây ──
const WAIT_GREEN_MAX = 10; // < 10p  → xanh
const WAIT_YELLOW_MAX = 20; // 10–20p → vàng;  > 20p → đỏ

// Thanh tiến trình kiểu Grab — 3 MỐC: Đang khám → Khám xong → Thanh toán.
// "Đến mốc nào tích xanh mốc ấy" (reached) suy từ visit.status:
//   • Đang khám   → IN_PROGRESS / FINALIZED / AMENDED
//   • Khám xong   → FINALIZED / AMENDED
//   • Thanh toán  → CHƯA nối billing (thu ngân) → unbacked: luôn xám, không tự xanh.
// OPEN = vừa check-in, đang chờ khám → mốc "Đang khám" là bước KẾ (current).
const MILESTONES: { key: string; label: string; unbacked?: boolean; note?: string }[] = [
  { key: "dang_kham", label: "Đang khám" },
  { key: "kham_xong", label: "Khám xong" },
  {
    key: "thanh_toan",
    label: "Thanh toán",
    unbacked: true,
    note: "Chờ thu ngân — chưa nối dữ liệu thanh toán",
  },
];

// Số mốc BACKED đã đạt (tích xanh). OPEN=0, IN_PROGRESS=1, FINALIZED/AMENDED=2.
function reachedCount(status: string): number {
  switch (status) {
    case "FINALIZED":
    case "AMENDED":
      return 2; // Đang khám + Khám xong
    case "IN_PROGRESS":
      return 1; // Đang khám
    case "OPEN":
    default:
      return 0; // mới check-in, đang chờ khám
  }
}

export function ProgressStepper({ status }: { status: string }) {
  const reached = reachedCount(status);

  return (
    <div className="flex items-start">
      {MILESTONES.map((m, i) => {
        let state: "done" | "current" | "upcoming" | "disabled";
        if (i < reached) state = "done";
        else if (m.unbacked) state = "disabled";
        else if (i === reached) state = "current";
        else state = "upcoming";

        // Node tròn kiểu Grab: done = xanh đặc + ✓; current = viền hồng nhấn (pulse);
        // upcoming = viền nhạt; disabled = nét đứt xám.
        const node =
          state === "done"
            ? "bg-[#16a34a] border-[#16a34a] text-white"
            : state === "current"
              ? "bg-white border-[#ec4899] ring-4 ring-[#ec4899]/15 animate-pulse"
              : state === "upcoming"
                ? "bg-white border-[#e4e4e7]"
                : "border-dashed bg-[#fafafa] border-[#e4e4e7]";
        const txt =
          state === "done"
            ? "text-[#15803d] font-medium"
            : state === "current"
              ? "text-[#ec4899] font-semibold"
              : state === "disabled"
                ? "text-[#c4c4c8]"
                : "text-[#a1a1aa]";

        return (
          <div key={m.key} className="flex flex-1 items-start">
            <div
              className="flex w-full min-w-0 flex-col items-center gap-1"
              title={m.unbacked ? `${m.label} — ${m.note}` : m.label}
            >
              <div className="flex w-full items-center">
                {/* nửa đoạn nối TRÁI (ẩn ở mốc đầu) — xanh khi mốc trước đã done */}
                <span
                  className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= reached ? "bg-[#16a34a]" : "bg-[#e4e4e7]"}`}
                />
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${node}`}
                >
                  {state === "done" ? (
                    <Check size={13} strokeWidth={3} />
                  ) : state === "current" ? (
                    <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
                  ) : null}
                </span>
                {/* nửa đoạn nối PHẢI (ẩn ở mốc cuối) — xanh khi mốc này đã done */}
                <span
                  className={`h-0.5 flex-1 ${i === MILESTONES.length - 1 ? "opacity-0" : i < reached ? "bg-[#16a34a]" : "bg-[#e4e4e7]"}`}
                />
              </div>
              <span className={`whitespace-nowrap text-[11px] leading-none ${txt}`}>
                {m.label}
              </span>
            </div>
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
