// /api/patients/check-phone?phone=...
//   GET → cảnh báo SỚM nếu SĐT đã có hồ sơ (feedback #9). CHỈ ĐỌC, KHÔNG tạo,
//   KHÔNG chặn. Mẹ đăng ký bằng số của mình cho con là hợp lệ → để nhân viên
//   tự quyết; ta chỉ hiện trùng với ai.
//
// Đi qua FastAPI (giống brief): chuẩn hoá +84/0 + tra DB nằm ở backend, trả về
// TỐI THIỂU (tên + mã BN + năm sinh) — KHÔNG CCCD, KHÔNG địa chỉ. Proxy chạy
// phía server: né CORS + giữ BACKEND_API_KEY ở server.
//
// Cảnh báo là tính năng PHỤ: backend tắt/timeout/lỗi → trả rỗng (không cảnh
// báo), KHÔNG để vỡ màn nhập. Guard trùng LÚC SUBMIT ở POST /api/patients vẫn
// là lưới chặn cuối.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../../lib/supabase-server";
import { getClinicRole } from "../../../../lib/clinic-session";
import { canWriteIntake } from "../../../../lib/roles";

const API_BASE = process.env.CLINIC_API_URL ?? "http://localhost:8000";

const EMPTY = { exists: false, matches: [] as unknown[] };

export async function GET(request: Request) {
  // 1) Phải đăng nhập (cổng chung Supabase).
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  // 2) Chỉ vai ghi tiếp nhận (CSKH/Lễ tân/QL/ĐD) — đúng vai dùng màn tạo BN.
  const role = await getClinicRole();
  if (!canWriteIntake(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phone = new URL(request.url).searchParams.get("phone")?.trim() ?? "";
  // Chỉ tra khi đã đủ 10 chữ số (sau khi bỏ ký tự thừa) → tránh gọi backend
  // mỗi lần gõ + tránh match nửa vời.
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) {
    return NextResponse.json(EMPTY);
  }

  const headers: Record<string, string> = {};
  const apiKey = process.env.BACKEND_API_KEY;
  if (apiKey) headers["X-API-Key"] = apiKey;

  // Tra DB thuần → nhanh; trần 8s để backend treo không kéo theo request này.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/api/v1/patients/check-phone?phone=${encodeURIComponent(phone)}`,
      { method: "GET", headers, signal: controller.signal, cache: "no-store" },
    );
  } catch {
    // ECONNREFUSED / timeout / DNS… — cảnh báo là phụ, im lặng trả rỗng.
    return NextResponse.json(EMPTY);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    return NextResponse.json(EMPTY);
  }

  let payload: { exists?: boolean; matches?: unknown[] };
  try {
    payload = (await res.json()) as { exists?: boolean; matches?: unknown[] };
  } catch {
    return NextResponse.json(EMPTY);
  }

  return NextResponse.json({
    exists: !!payload.exists,
    matches: Array.isArray(payload.matches) ? payload.matches : [],
  });
}
