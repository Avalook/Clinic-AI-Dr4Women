-- Rollback: gỡ cột auth_user_id khỏi staff (FK + index + column).
-- Cảnh báo: nếu đã seed auth_user_id cho staff thật, rollback xoá data
-- mapping; phải re-seed sau khi re-up.

DROP INDEX IF EXISTS idx_staff_auth_user_id_unique;

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_auth_user_id_fkey;

ALTER TABLE staff
  DROP COLUMN IF EXISTS auth_user_id;
