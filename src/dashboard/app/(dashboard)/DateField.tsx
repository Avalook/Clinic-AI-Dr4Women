"use client";

// Ô NGÀY DUY NHẤT (gộp ngày/tháng/năm thành 1 control) — D19.
//   • Hiển thị + nhập DD/MM/YYYY (không phụ thuộc locale trình duyệt).
//   • KẸP PHẠM VI NGAY KHI GÕ: ngày 1–31, tháng 1–12, năm [minYear..maxYear]
//     (mặc định 1900..hiện tại+10; ô ngày sinh truyền max=hôm nay → 1900..nay).
//     KHÔNG bao giờ để lọt ngày 33 / tháng 34 / năm 3245.
//   • Gõ LIÊN TỤC: nhận diện ngày/tháng 1 chữ số để tự nhảy ô — gõ "7" rồi "8"
//     → "07/08"; gõ "07082019" → "07/08/2019".
//   • Nút lịch mở bộ chọn native; value/onChange dùng ISO "yyyy-mm-dd".

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { daysInMonth } from "../../lib/validation";
import { INPUT } from "./form-ui";

/** ISO "yyyy-mm-dd" → "dd/mm/yyyy" để hiển thị; chuỗi khác → "". */
function isoToText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** d/m/y (chuỗi ĐÃ kẹp) → ISO; "" nếu thiếu phần hoặc KHÔNG phải ngày lịch hợp lệ
 *  (vd 31/02). Kẹp phạm vi đã làm ở maskParts; đây là rào chốt cuối. */
function partsToIso(d: string, mo: string, y: string): string {
  if (!d || !mo || y.length !== 4) return "";
  const dd = Number(d);
  const mm = Number(mo);
  const yy = Number(y);
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yy))
    return "";
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > daysInMonth(mm, yy)) return "";
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Kẹp chuỗi 2 chữ số vào [lo, hi] rồi pad 0. */
function clamp2(s: string, lo: number, hi: number): string {
  let n = Number(s);
  if (n < lo) n = lo;
  if (n > hi) n = hi;
  return String(n).padStart(2, "0");
}

/** Dựng chuỗi hiển thị; tự chèn "/" sau khi NGÀY (2 ký tự) / THÁNG (2 ký tự) chốt
 *  → người dùng thấy ranh giới khi gõ liền. */
function buildDisplay(d: string, m: string, y: string): string {
  let t = d;
  if (m !== "" || d.length === 2) t += "/" + m;
  if (y !== "" || m.length === 2) t += "/" + y;
  return t;
}

export default function DateField({
  value,
  onChange,
  min,
  max,
  className,
  ariaLabel,
  invalid,
}: {
  /** ISO "yyyy-mm-dd" hoặc "". */
  value: string;
  /** Nhận ISO "yyyy-mm-dd" (đã hợp lệ) hoặc "". */
  onChange: (iso: string) => void;
  /** ISO chặn dưới/trên cho bộ chọn lịch native + kẹp NĂM khi gõ tay. */
  min?: string;
  max?: string;
  className?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(() => isoToText(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Khoảng NĂM hợp lệ suy từ min/max (ô ngày sinh: max=hôm nay → tối đa = năm nay;
  // không người sống nào sinh năm 3245). Mặc định 1900..(năm nay+10) cho ô ngày khám.
  const curYear = new Date().getFullYear();
  const maxYear = max && /^\d{4}/.test(max) ? Number(max.slice(0, 4)) : curYear + 10;
  const minYear = min && /^\d{4}/.test(min) ? Number(min.slice(0, 4)) : 1900;

  const clampYear = (y: string): string => {
    if (y.length !== 4) return y; // chưa đủ 4 số → chưa kẹp (đang gõ)
    let n = Number(y);
    if (n < minYear) n = minYear;
    if (n > maxYear) n = maxYear;
    return String(n).padStart(4, "0");
  };

  // Gõ LIÊN TỤC (không "/"): máy trạng thái nhận diện ngày 1–31 / tháng 1–12, số
  // đầu ≥4 (ngày) / ≥2 (tháng) = 1 chữ số → tự nhảy ô.
  function maskContinuous(digits: string): { d: string; m: string; y: string } {
    let i = 0;
    let d = "";
    let m = "";
    let y = "";
    if (i < digits.length) {
      const a = digits[i];
      if (a >= "4") {
        d = "0" + a; // 4..9 không thể là chục của ngày ≤31 → ngày 1 chữ số
        i += 1;
      } else if (i + 1 < digits.length) {
        const two = digits.slice(i, i + 2);
        if (Number(two) >= 1 && Number(two) <= 31) {
          d = two;
          i += 2;
        } else {
          d = "0" + a; // 2 số >31 → ngày = 0a, số sau sang tháng
          i += 1;
        }
      } else {
        d = a; // mới 1 số → chờ
        i += 1;
      }
    }
    if (d.length === 2 && i < digits.length) {
      const a = digits[i];
      if (a >= "2") {
        m = "0" + a; // 2..9 không thể là chục của tháng ≤12 → tháng 1 chữ số
        i += 1;
      } else if (i + 1 < digits.length) {
        const two = digits.slice(i, i + 2);
        if (Number(two) >= 1 && Number(two) <= 12) {
          m = two;
          i += 2;
        } else {
          m = "0" + a;
          i += 1;
        }
      } else {
        m = a;
        i += 1;
      }
    }
    if (m.length === 2 && i < digits.length) {
      y = digits.slice(i, i + 4);
    }
    return { d, m, y };
  }

  // Người dùng tự gõ "/" → tôn trọng ranh giới, vẫn kẹp từng phần.
  function maskSlashed(raw: string): { d: string; m: string; y: string } {
    const parts = raw.split("/");
    let d = (parts[0] ?? "").replace(/\D/g, "").slice(0, 2);
    let m = (parts[1] ?? "").replace(/\D/g, "").slice(0, 2);
    const y = parts.slice(2).join("").replace(/\D/g, "").slice(0, 4);
    if (d.length === 2) d = clamp2(d, 1, 31);
    if (m.length === 2) m = clamp2(m, 1, 12);
    return { d, m, y };
  }

  function emit(d: string, m: string, y: string) {
    const yc = clampYear(y);
    setText(buildDisplay(d, m, yc));
    onChange(partsToIso(d, m, yc));
  }

  function onType(raw: string) {
    const cleaned = (raw ?? "").replace(/[^\d/]/g, "");
    const { d, m, y } = cleaned.includes("/")
      ? maskSlashed(cleaned)
      : maskContinuous(cleaned);
    emit(d, m, y);
  }

  function onBlur() {
    // Rời ô: pad ngày/tháng 1 chữ số ("7" → "07") + kẹp lại cho chắc.
    const parts = text.split("/");
    let d = (parts[0] ?? "").replace(/\D/g, "").slice(0, 2);
    let m = (parts[1] ?? "").replace(/\D/g, "").slice(0, 2);
    const y = parts.slice(2).join("").replace(/\D/g, "").slice(0, 4);
    if (!d && !m && !y) return;
    if (d) d = clamp2(d, 1, 31);
    if (m) m = clamp2(m, 1, 12);
    emit(d, m, y);
  }

  function openPicker() {
    try {
      nativeRef.current?.showPicker?.();
    } catch {
      /* trình duyệt cũ không hỗ trợ showPicker — bỏ qua */
    }
  }

  function onNative(v: string) {
    if (!v) return; // v = "yyyy-mm-dd"
    setText(isoToText(v));
    onChange(v); // bộ chọn native luôn cho ISO hợp lệ
  }

  return (
    <div className="relative flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => onType(e.target.value)}
        onBlur={onBlur}
        placeholder="DD/MM/YYYY"
        aria-label={ariaLabel}
        className={(className ?? INPUT) + (invalid ? " border-[#dc2626]" : "")}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Chọn ngày từ lịch"
        className="shrink-0 rounded-lg border border-[#e4e4e7] bg-white p-2 text-[#71717a] hover:bg-[#f4f4f5]"
      >
        <CalendarDays size={18} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onNative(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}
