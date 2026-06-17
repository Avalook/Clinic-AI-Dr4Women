-- Seed 2 staff thu ngân tách vai (CASHIER_THUOC + CASHIER_DV) để 2 vai mới
-- gán/chọn được ở role-picker (T-DASH-CASHIER-SPLIT-01). Cần migration 052
-- (CHECK đã chấp nhận 2 value mới) chạy TRƯỚC. Re-runnable: guard IF NOT EXISTS
-- trên full_name. Liên kết auth cá nhân làm sau (hiện shared-login + role-picker).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thu ngân thuốc') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thu ngân thuốc', 'TN thuốc', 'CASHIER_THUOC', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thu ngân dịch vụ') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thu ngân dịch vụ', 'TN dịch vụ', 'CASHIER_DV', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
END $$;

COMMIT;
