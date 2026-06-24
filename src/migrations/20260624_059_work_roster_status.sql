-- Trạng thái duyệt cho ca tự đăng ký. Nhân viên (không phải quản lý) đăng ký ca
-- → PENDING (chờ duyệt), KHÔNG hiện trên lịch chung tới khi quản lý duyệt.
-- Quản lý tạo/duyệt → APPROVED. Default APPROVED để mọi dòng cũ vẫn hiển thị.

BEGIN;

ALTER TABLE work_roster
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED'
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_work_roster_week_status
  ON work_roster (week_start, status);

COMMENT ON COLUMN work_roster.status IS
  'PENDING = ca tự đăng ký chờ quản lý duyệt; APPROVED = đã lên lịch chung; REJECTED = bị từ chối';

COMMIT;
