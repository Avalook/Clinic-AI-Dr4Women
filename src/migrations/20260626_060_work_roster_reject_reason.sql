-- Lý do từ chối ca tự đăng ký. Khi quản lý TỪ CHỐI (status = REJECTED) thì nhập
-- lý do để người đăng ký biết nguyên nhân (hiện qua toast + ô "Của tôi"). Khi
-- DUYỆT (APPROVED) thì xoá lý do cũ (nếu trước đó từng bị từ chối rồi mở lại).

BEGIN;

ALTER TABLE work_roster
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

COMMENT ON COLUMN work_roster.reject_reason IS
  'Lý do quản lý từ chối ca (chỉ có nghĩa khi status = REJECTED).';

-- App đọc qua PostgREST (Supabase REST) có cache schema. Sau khi thêm cột mới,
-- phải báo PostgREST nạp lại, nếu không query đọc/ghi `reject_reason` sẽ lỗi và
-- trả rỗng (lịch trông như "mất" dù data còn nguyên).
NOTIFY pgrst, 'reload schema';

COMMIT;
