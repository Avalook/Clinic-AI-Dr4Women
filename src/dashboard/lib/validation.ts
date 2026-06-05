// Quy tắc nhập liệu CỨNG dùng chung (client form + server API), 1 nguồn sự thật.
//   - SĐT: đúng 10 chữ số viết liền (số VN).
//   - CCCD: đúng 12 chữ số viết liền.
// Trường rỗng = hợp lệ (các trường này tuỳ chọn); chỉ chặn khi CÓ nhập mà sai.

export const PHONE_RE = /^\d{10}$/;
export const CCCD_RE = /^\d{12}$/;

/** Bỏ mọi ký tự không phải chữ số (dùng cho onChange ép "số viết liền"). */
export const digitsOnly = (s: string): string => (s ?? "").replace(/\D/g, "");

/** null = hợp lệ (hoặc rỗng); chuỗi = thông báo lỗi. */
export function phoneError(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  return PHONE_RE.test(t) ? null : "Số điện thoại phải gồm đúng 10 chữ số liền.";
}

export function cccdError(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  return CCCD_RE.test(t) ? null : "CCCD phải gồm đúng 12 chữ số liền.";
}

// ===== Ngày sinh dd/mm/yyyy — có LOGIC LỊCH (không 30/2, 29/2 chỉ năm nhuận) =====

/** Số ngày tối đa của tháng m (1-12) trong năm y — đúng năm nhuận (29/2). */
export function daysInMonth(m: number, y: number): number {
  if (m === 2) return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Ghép d/m/y (chuỗi) → "yyyy-mm-dd"; thiếu bất kỳ phần nào → "". Không kiểm hợp lệ. */
export function dmyToIso(day: string, month: string, year: string): string {
  const d = (day ?? "").trim();
  const m = (month ?? "").trim();
  const y = (year ?? "").trim();
  if (!d || !m || !y) return "";
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Năm sinh (chế độ "Chỉ biết năm"). null = hợp lệ (hoặc CHƯA nhập); chuỗi = lỗi
 * nhỏ cạnh ô. `maxYear` = năm hiện tại (không cho năm tương lai).
 */
export function birthYearError(
  year: string,
  maxYear: number,
): string | null {
  const t = (year ?? "").trim();
  if (!t) return null;
  const y = Number(t);
  if (!Number.isInteger(y)) return "Năm sinh không hợp lệ.";
  if (y > maxYear) return "Năm sinh không thể ở tương lai.";
  if (y < 1900) return `Năm sinh không hợp lệ (1900–${maxYear}).`;
  return null;
}

/**
 * Kiểm ngày sinh dd/mm/yyyy. null = hợp lệ (hoặc CHƯA nhập gì — caller tự bắt
 * "bắt buộc"); chuỗi = lỗi nhỏ hiện cạnh ô.
 * - `maxIso` = hôm nay (yyyy-mm-dd): ngày sinh KHÔNG được sau hôm nay.
 * - Bắt 30/2, 31/4…, 29/2 chỉ năm nhuận; năm 1900..năm hiện tại.
 */
export function dobError(
  day: string,
  month: string,
  year: string,
  maxIso: string,
): string | null {
  const d = (day ?? "").trim();
  const m = (month ?? "").trim();
  const y = (year ?? "").trim();
  if (!d && !m && !y) return null; // chưa nhập gì
  if (!d || !m || !y) return "Nhập đủ ngày/tháng/năm.";
  const dd = Number(d);
  const mm = Number(m);
  const yy = Number(y);
  const curYear = Number(maxIso.slice(0, 4));
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yy))
    return "Ngày/năm không hợp lệ.";
  if (yy < 1900 || yy > curYear) return "Ngày/năm không hợp lệ.";
  if (mm < 1 || mm > 12) return "Ngày/năm không hợp lệ.";
  if (dd < 1 || dd > daysInMonth(mm, yy)) return "Ngày/năm không hợp lệ.";
  if (dmyToIso(d, m, y) > maxIso) return "Ngày sinh không thể ở tương lai.";
  return null;
}
