-- Phase 1 Onboard / Nhóm 2 — PatientNextOfKin.
-- Đóng 3/3 nợ Phase 1 từ SYSTEM_STATE_ACTUAL §2.1.
--
-- Lưu thông tin người nhà của BN: chồng / mẹ đẻ / mẹ chồng / con / ...
-- Mỗi người là 1 dòng riêng — thêm bao nhiêu cũng được mà không cần
-- sửa cấu trúc. Dùng để gọi/nhắn khẩn khi BN cần hỗ trợ hoặc có XN
-- bất thường cần thông báo người nhà.
--
-- Schema theo Onboard-phase1.md Nhóm 2 / PatientNextOfKin.

BEGIN;

CREATE TABLE IF NOT EXISTS patient_next_of_kin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    relation TEXT NOT NULL,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    zalo_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mỗi BN nên có đúng 1 primary contact (partial UNIQUE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_next_of_kin_primary
    ON patient_next_of_kin (clinic_patient_id)
    WHERE is_primary_contact = TRUE;

CREATE INDEX IF NOT EXISTS idx_patient_next_of_kin_patient
    ON patient_next_of_kin (clinic_patient_id);

COMMENT ON TABLE patient_next_of_kin IS 'Phase 1 — người nhà của BN (chồng/mẹ/con/...) để liên lạc khẩn. 1 BN có nhiều dòng.';
COMMENT ON COLUMN patient_next_of_kin.relation IS 'Tự do: Chồng / Mẹ đẻ / Mẹ chồng / Con / Anh chị em / ...';
COMMENT ON COLUMN patient_next_of_kin.is_primary_contact IS 'Người liên lạc ưu tiên — partial UNIQUE enforce 1 primary per BN.';
COMMENT ON COLUMN patient_next_of_kin.zalo_id IS 'Zalo user id của người nhà (nullable) — tự link khi họ nhắn lần đầu.';

COMMIT;
