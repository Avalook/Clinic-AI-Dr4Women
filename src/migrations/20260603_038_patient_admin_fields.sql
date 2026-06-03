-- Migration 038: bổ sung trường HÀNH CHÍNH cho `patient` để khớp form "TÓM TẮT
-- KHÁM BỆNH" (mục I. Hành chính). Trước đây patient chỉ có họ tên / ngày sinh /
-- SĐT / CCCD → form bác sĩ thiếu Giới tính, Dân tộc, Quốc tịch, Nghề nghiệp,
-- Đối tượng, Địa chỉ, Người bảo lãnh. Các cột này CSKH/Lễ tân nhập ở "Thêm khách
-- hàng" rồi ĐỒNG BỘ sang phần hành chính của hồ sơ lâm sàng (read-only cho bác sĩ).
-- Tất cả NULLABLE — không phá dữ liệu sẵn có. Re-runnable (ADD COLUMN IF NOT EXISTS).

BEGIN;

ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS gender            TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity         TEXT,
  ADD COLUMN IF NOT EXISTS nationality       TEXT,
  ADD COLUMN IF NOT EXISTS occupation        TEXT,
  ADD COLUMN IF NOT EXISTS patient_objection TEXT,
  ADD COLUMN IF NOT EXISTS address           TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name     TEXT;

-- Giới tính chỉ Nam/Nữ (cho phép NULL khi chưa nhập). Inline-safe re-run: drop rồi add.
ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_gender_check;
ALTER TABLE patient ADD CONSTRAINT patient_gender_check
  CHECK (gender IS NULL OR gender IN ('Nam', 'Nữ'));

COMMENT ON COLUMN patient.gender IS 'Giới tính: Nam/Nữ (mục I.3 form khám)';
COMMENT ON COLUMN patient.ethnicity IS 'Dân tộc (mục I.4)';
COMMENT ON COLUMN patient.nationality IS 'Quốc tịch (mục I.5)';
COMMENT ON COLUMN patient.occupation IS 'Nghề nghiệp (mục I.6)';
COMMENT ON COLUMN patient.patient_objection IS 'Đối tượng: DV/BHYT/... (mục I.7)';
COMMENT ON COLUMN patient.address IS 'Địa chỉ (mục I.8)';
COMMENT ON COLUMN patient.guardian_name IS 'Họ tên người bảo lãnh (mục I.9)';

COMMIT;
