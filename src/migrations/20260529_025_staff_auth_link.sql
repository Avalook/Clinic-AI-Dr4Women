-- Liên kết Supabase Auth user ↔ staff row (DASH-RBAC-01).
-- Bối cảnh: dashboard Phase 1 cần biết NV đang login là BS nào để lọc
-- lịch/BN ("Lịch của tôi"). Map qua cột nullable + UNIQUE — một staff
-- ràng buộc 0..1 auth user; auth.users do Supabase tạo riêng.
-- Phạm vi P4: tối thiểu để demo. RBAC role/department-scope policy
-- thật sự nằm trong P11 (D-doctor-scope) — giữ policy mở (authenticated
-- USING true) đến khi đóng packet RBAC.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL;

-- FK trỏ vào schema auth.users. ON DELETE SET NULL để xoá user trong
-- Supabase Auth không cascade làm mất staff row (staff vẫn cần giữ cho
-- lịch sử ca trực + sub-relation lab_result.reviewed_by_staff_id…).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_auth_user_id_fkey'
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT staff_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Một auth user chỉ map 1 staff (tránh login lẫn).
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_auth_user_id_unique
  ON staff (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN staff.auth_user_id IS
  'Supabase Auth user UUID — login mapping. Null cho NV chưa cấp acc dashboard.';
