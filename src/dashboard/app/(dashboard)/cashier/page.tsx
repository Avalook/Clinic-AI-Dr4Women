// Màn Thu ngân (T-DASH-THUNGAN-01) — 2 view: "Thu ngân thuốc" / "Thu ngân dịch vụ".
// DỰNG KHUNG: phần thu tiền theo buổi khám sẽ nối sau; hiện trang quản lý BẢNG GIÁ
// khung (service_price) theo từng nhóm — đơn giá để trống, phòng khám nhập sau.
// Đọc qua getSupabaseServer() (RLS SELECT service_price_select_authenticated); ghi
// qua route service-role /api/service-price (gọi từ CashierView client).

import { getSupabaseServer } from "../../../lib/supabase-server";
import { requireNavAccess } from "../../../lib/clinic-session";
import CashierView, { type PriceRow } from "./CashierView";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  await requireNavAccess("/cashier");
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from("service_price")
    .select("id, service_code, name, group, unit_price, active")
    .order("group", { ascending: true })
    .order("service_code", { ascending: true })
    .limit(1000);

  const rows = (data as PriceRow[] | null) ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#171717]">Thu ngân</h1>
        <p className="text-sm text-[#888888]">
          Bảng giá khung theo nhóm. Phần thu tiền theo buổi khám sẽ nối sau —
          hiện nhập/sửa đơn giá để chuẩn bị. Đơn giá để trống = chưa chốt giá.
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-[#fee2e2] px-3 py-2 text-sm text-[#dc2626]">
          {error.message}
        </div>
      ) : (
        <CashierView rows={rows} />
      )}
    </div>
  );
}
