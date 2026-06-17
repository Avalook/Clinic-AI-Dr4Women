-- Seed 1 staff "Thư ký Y khoa" (TKYK) để vai TKYK gán/chọn được ở role-picker
-- (T-DASH-TKYK-CLINICAL-01). Cần migration 049 (CHECK đã chấp nhận 'TKYK') chạy
-- TRƯỚC. Re-runnable: guarded by IF NOT EXISTS trên full_name.
--
-- Liên kết auth (đăng nhập cá nhân) làm sau qua /settings hoặc link_staff_to_auth.py
-- — hiện dùng shared-login + role-picker như các vai khác.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thư ký Y khoa') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thư ký Y khoa', 'TKYK', 'TKYK', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
END $$;

COMMIT;
