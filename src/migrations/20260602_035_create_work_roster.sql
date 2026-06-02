-- Lịch làm việc theo phòng/trạm (weekly roster). Mỗi dòng = 1 phân công:
-- (tuần, ngày, ca, trạm) → 1 nhân viên. staff_id liên kết tuỳ chọn để lọc
-- "lịch của tôi"; staff_name là tên hiển thị trên bảng (giống Google Sheet PK).
-- Ghi qua service-role (API admin). RLS: chỉ mở SELECT cho authenticated.

BEGIN;

CREATE TABLE IF NOT EXISTS work_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    work_date DATE NOT NULL,
    shift TEXT NOT NULL DEFAULT 'FULL' CHECK (shift IN ('FULL','SANG','CHIEU')),
    station TEXT NOT NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_roster_week ON work_roster (week_start);
CREATE INDEX IF NOT EXISTS idx_work_roster_date ON work_roster (work_date);
CREATE INDEX IF NOT EXISTS idx_work_roster_staff ON work_roster (staff_id);

COMMENT ON TABLE work_roster IS 'Lịch phân công ca trực theo phòng/trạm (weekly roster)';

ALTER TABLE work_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_roster_select_authenticated ON work_roster;
CREATE POLICY work_roster_select_authenticated
  ON work_roster
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
