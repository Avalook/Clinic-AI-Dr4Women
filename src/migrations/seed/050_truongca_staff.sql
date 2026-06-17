-- Seed 1 staff "Trưởng ca" (TRUONG_CA) để vai TRUONG_CA gán/chọn được ở role-picker
-- (T-DASH-TRUONGCA-01). Cần migration 050 (CHECK đã chấp nhận 'TRUONG_CA') chạy
-- TRƯỚC. Re-runnable: guarded by IF NOT EXISTS trên full_name.
--
-- Liên kết auth (đăng nhập cá nhân) làm sau qua /settings hoặc link_staff_to_auth.py
-- — hiện dùng shared-login + role-picker như các vai khác.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Trưởng ca') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Trưởng ca', 'Trưởng ca', 'TRUONG_CA', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
END $$;

COMMIT;
