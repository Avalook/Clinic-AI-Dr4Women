"use client";

// Ô chọn GIỜ 24h (HH:MM) — 2 dropdown: Giờ (00–23) + Phút (00,05,…,55). Thay cho
// <input type="time"> vì native hiển thị AM/PM theo locale máy (không ép 24h được).
// value = "HH:MM" hoặc ""; onChange trả "HH:MM" (phần chưa chọn mặc định "00").

import { INPUT } from "./form-ui";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export default function Time24Input({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const emit = (nh: string, nm: string) =>
    onChange(!nh && !nm ? "" : `${nh || "00"}:${nm || "00"}`);
  return (
    <div className="flex items-center gap-2">
      <select
        value={h ?? ""}
        onChange={(e) => emit(e.target.value, m ?? "")}
        className={INPUT}
        aria-label="Giờ (24h)"
      >
        <option value="">Giờ</option>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="shrink-0 text-[#a1a1aa]">:</span>
      <select
        value={m ?? ""}
        onChange={(e) => emit(h ?? "", e.target.value)}
        className={INPUT}
        aria-label="Phút"
      >
        <option value="">Phút</option>
        {MINUTES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
