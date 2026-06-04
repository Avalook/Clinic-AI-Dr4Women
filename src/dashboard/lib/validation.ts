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
