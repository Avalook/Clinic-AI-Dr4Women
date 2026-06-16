-- Bảng giá KHUNG dịch vụ / thuốc cho màn Thu ngân (T-DASH-THUNGAN-01).
-- DỰNG KHUNG: data trống, đơn giá (unit_price) NULLABLE để phòng khám nhập sau.
-- "group" phân 2 nhóm khớp 2 view màn thu ngân:
--   'thuoc'   → view "Thu ngân thuốc"
--   'dich_vu' → view "Thu ngân dịch vụ"
-- Catalog ĐỘC LẬP (không FK sang service_type) — giá có thể đặt theo mã riêng.
-- Ghi qua service-role (route /api/service-price). RLS: chỉ mở SELECT cho authenticated.
-- KHÔNG nằm trong nhóm append-only lâm sàng → cho phép UPDATE/DELETE bình thường.

BEGIN;

CREATE TABLE IF NOT EXISTS service_price (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code TEXT NOT NULL,
    name TEXT NOT NULL,
    -- "group" là từ khoá SQL → luôn đặt trong ngoặc kép khi tham chiếu.
    "group" TEXT NOT NULL CHECK ("group" IN ('thuoc', 'dich_vu')),
    unit_price NUMERIC(12, 0),               -- VND, không phần lẻ; NULL = chưa nhập giá
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mã dịch vụ duy nhất trong từng nhóm (tránh trùng mã khi nhập tay).
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_price_code_group
    ON service_price ("group", service_code);
CREATE INDEX IF NOT EXISTS idx_service_price_group_active
    ON service_price ("group")
    WHERE active;

COMMENT ON TABLE service_price IS
    'Bảng giá khung dịch vụ/thuốc cho màn Thu ngân (unit_price nhập sau)';

ALTER TABLE service_price ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_price_select_authenticated ON service_price;
CREATE POLICY service_price_select_authenticated
  ON service_price
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
