"use client";

// Ô NGÀY DUY NHẤT (gộp ngày/tháng/năm rời thành 1 control) — D19.
//   • Hiển thị + nhập theo DD/MM/YYYY (không phụ thuộc locale trình duyệt).
//   • Gõ số tự chèn "/"; rời ô tự đệm 0 (gõ "7" → "07").
//   • Nút lịch mở bộ chọn ngày native (chọn nhanh bằng chuột).
//   • value/onChange dùng ISO "yyyy-mm-dd" (ĐÚNG kiểu date đang lưu DB) — emit ""
//     khi trống hoặc chưa hợp lệ (caller tự bắt "bắt buộc"/"tương lai").

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { daysInMonth } from "../../lib/validation";
import { INPUT } from "./form-ui";

/** ISO "yyyy-mm-dd" → "dd/mm/yyyy" để hiển thị; chuỗi khác → "". */
function isoToText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** d/m/y (chuỗi) → ISO; "" nếu thiếu phần hoặc KHÔNG phải ngày lịch hợp lệ. */
function partsToIso(d: string, mo: string, y: string): string {
  if (!d || !mo || y.length !== 4) return "";
  const dd = Number(d);
  const mm = Number(mo);
  const yy = Number(y);
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yy))
    return "";
  if (mm < 1 || mm > 12) return "";
  if (yy < 1900 || yy > 2200) return "";
  if (dd < 1 || dd > daysInMonth(mm, yy)) return "";
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Tách chuỗi đang gõ thành ngày/tháng/năm. Tôn trọng "/" người dùng gõ; nếu
 *  chưa gõ "/" thì cắt theo vị trí 2/2/4 (cho dán liền "07082019"). */
function splitText(s: string): { d: string; m: string; y: string; segs: number } {
  const clean = (s ?? "").replace(/[^\d/]/g, "");
  const parts = clean.split("/");
  let d: string;
  let m: string;
  let y: string;
  if (parts.length === 1) {
    const digits = parts[0];
    d = digits.slice(0, 2);
    m = digits.slice(2, 4);
    y = digits.slice(4, 8);
  } else {
    d = parts[0] ?? "";
    m = parts[1] ?? "";
    y = parts.length > 2 ? parts.slice(2).join("") : "";
    // Tràn chữ số (gõ liền không kịp "/") → đẩy sang phần sau.
    if (d.length > 2) {
      m = d.slice(2) + m;
      d = d.slice(0, 2);
    }
    if (m.length > 2) {
      y = m.slice(2) + y;
      m = m.slice(0, 2);
    }
    d = d.slice(0, 2);
    m = m.slice(0, 2);
    y = y.replace(/\D/g, "").slice(0, 4);
  }
  return { d, m, y, segs: parts.length };
}

/** Dựng lại chuỗi hiển thị; chỉ chèn "/" khi phần sau có nội dung HOẶC người dùng
 *  đã gõ "/" (segs) — tránh kẹt khi xoá lùi. */
function buildText(d: string, m: string, y: string, segs: number): string {
  let text = d;
  if (m !== "" || segs >= 2) text += "/" + m;
  if (y !== "" || segs >= 3) text += "/" + y;
  return text;
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
  /** ISO chặn dưới/trên cho bộ chọn lịch native. */
  min?: string;
  max?: string;
  className?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(() => isoToText(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  function onType(raw: string) {
    const { d, m, y, segs } = splitText(raw);
    setText(buildText(d, m, y, segs));
    onChange(partsToIso(d, m, y));
  }

  function onBlur() {
    const { d, m, y } = splitText(text);
    if (!d && !m && !y) return;
    const pd = d ? d.padStart(2, "0") : d;
    const pm = m ? m.padStart(2, "0") : m;
    setText(buildText(pd, pm, y, y ? 3 : pm ? 2 : 1));
    onChange(partsToIso(pd, pm, y));
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
