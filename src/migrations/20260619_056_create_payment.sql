-- T-DASH-PAYMENT-01 — bảng payment: chốt thu tiền 1 lượt khám theo TỪNG khâu.
--   kind = 'thuoc' (thu ngân thuốc) | 'dich_vu' (thu ngân dịch vụ).
--   1 dòng (visit_id, kind) = khâu đó ĐÃ THU. Hoàn tác = xoá dòng.
-- Mục đích: 2 màn thu ngân (thuốc / dịch vụ) + thanh tiến trình Lễ tân ĐỒNG BỘ —
--   khi mọi khâu PHẢI thu đã có dòng PAID → mốc "Đã thanh toán" tích xanh.
-- RLS: chỉ SELECT cho authenticated (mirror 021 visit); ghi qua service-role.
-- KHÔNG đụng visit.status / FINALIZED / 043 / lâm sàng.

BEGIN;

CREATE TABLE IF NOT EXISTS payment (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id          UUID NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
    clinic_patient_id UUID REFERENCES patient(clinic_patient_id) ON DELETE SET NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('thuoc', 'dich_vu')),
    status            TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID')),
    amount            BIGINT,
    paid_by_staff_id  UUID REFERENCES staff(id) ON DELETE SET NULL,
    paid_by_text      TEXT,
    paid_at           TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (visit_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_payment_visit ON payment (visit_id);

ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_select_authenticated ON payment;
CREATE POLICY payment_select_authenticated
  ON payment
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE payment IS 'Chốt thu tiền 1 lượt khám theo khâu (thuoc/dich_vu). 1 dòng (visit_id,kind)=đã thu. RLS SELECT authenticated, ghi qua service-role.';

COMMIT;
