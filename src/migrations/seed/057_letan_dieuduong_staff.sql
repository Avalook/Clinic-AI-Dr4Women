-- Seed 2 tài khoản TEST rõ tên cho 2 vai ĐÃ TÁCH: "Lễ tân" (RECEPTION) +
-- "Điều dưỡng" (NURSE_ULTRASOUND) — để PK test phân quyền (lâm sàng vs hành chính).
-- 2 department này VỐN hợp lệ (vai gốc) → KHÔNG cần migration CHECK. Re-runnable:
-- guard IF NOT EXISTS trên full_name. Auth cá nhân làm sau (shared-login + role-picker).
--
-- Phân quyền đã có ở lib/roles.ts:
--   • Điều dưỡng = canWriteClinical → ghi Sinh hiệu + nhập hộ "Lý do khám bệnh"
--     (chief_complaint, do BS đưa ra) vào bệnh án.
--   • Lễ tân = hành chính / check-in, KHÔNG ghi lâm sàng.
--   ("Vấn đề khiến BN đi khám" = patient.van_de_di_kham do CSKH khai lúc đặt lịch,
--    KHÁC HẲN "Lý do khám bệnh".)

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Lễ tân') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Lễ tân', 'Lễ tân', 'RECEPTION', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Điều dưỡng') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Điều dưỡng', 'Điều dưỡng', 'NURSE_ULTRASOUND', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
END $$;

COMMIT;
