-- T-DASH-CSKH-VANDE-LINHVUC-01 — 2 field CSKH khai thác lúc đặt lịch / tạo BN:
--   van_de_di_kham (text) = "Vấn đề khiến BN đi khám" do CSKH ghi — KHÁC HẲN
--     chief_complaint_at_visit ("Lý do khám bệnh" do BÁC SĨ ghi trong buổi khám,
--     ở bảng clinical_record — KHÔNG đụng).
--   linh_vuc (text, CHECK 5 mã) = chuyên khoa, DÙNG LẠI 5 service_code có sẵn
--     (PK/SK/NT/HMVS/NK = 5 form chuyên khoa) → map được sang form khám sau này.
-- Cả 2 NULLABLE (BN cũ không có). KHÔNG đụng lâm sàng/visit/FINALIZED/043.

BEGIN;

ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS van_de_di_kham TEXT,
  ADD COLUMN IF NOT EXISTS linh_vuc       TEXT;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_linh_vuc_check;
ALTER TABLE patient ADD CONSTRAINT patient_linh_vuc_check
  CHECK (linh_vuc IS NULL OR linh_vuc = ANY (ARRAY['PK','SK','NT','HMVS','NK']));

COMMIT;
