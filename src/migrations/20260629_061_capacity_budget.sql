-- Migration 061 — Capacity Phase 1: phân loại tải/ca + ngân sách khung-giờ theo cơ sở.
-- Task: T-20260629-CAP-01 (Decision Doc v2). Liên quan D027 (appointment≠visit), D017 (sau dời sang Scheduling graph).
-- ADDITIVE-ONLY (DEC-4): chỉ ADD COLUMN nullable + bảng mới. KHÔNG sửa/bỏ cột cũ, KHÔNG đụng constraint 6-overlap (DEC-1).
-- SAU KHI CHẠY: NOTIFY pgrst, 'reload schema';  (nếu không màn trống dù data còn — memory postgrest-reload-after-ddl)

BEGIN;

-- 061.1 — Tải/ca trên appointment. CSKH nhập/xác nhận tay (DEC-3), KHÔNG auto-suy từ phút slot.
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS patient_kind text
    CHECK (patient_kind IN ('NEW', 'RETURN')),
  ADD COLUMN IF NOT EXISTS thanh_min int CHECK (thanh_min BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS sono_min  int CHECK (sono_min  BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS need_sono boolean;

COMMENT ON COLUMN appointment.patient_kind IS
  'NEW=khám lần đầu, RETURN=tái khám. CSKH chọn tay. Quyết định tải Thành/siêu âm.';
COMMENT ON COLUMN appointment.thanh_min IS
  'Phút BS Thành dự kiến (B1+B3 cộng lại). CSKH xác nhận; mặc định gợi theo dịch vụ + loại khách.';
COMMENT ON COLUMN appointment.sono_min IS
  'Phút chiếm trạm siêu âm. 0 nếu không cần (Phase 2 mới chặn theo ngân sách sono).';
COMMENT ON COLUMN appointment.need_sono IS 'Bệnh nhân có đi siêu âm trong lượt khám này không.';

-- 061.2 — Ngân sách tải theo CƠ SỞ × bác sĩ × thứ × khung-giờ (DEC-5: seed ước lượng, đo lại từ visit.exam_completed_at).
-- location_id bắt buộc (V2#1): Kim Ngưu vs Nam Đồng khác phòng/khác trạm siêu âm.
CREATE TABLE IF NOT EXISTS block_budget (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES clinic_location(id),
  doctor_id        uuid REFERENCES staff(id),               -- NULL = default mọi BS tại cơ sở
  weekday          int  CHECK (weekday BETWEEN 0 AND 6),     -- 0=CN..6=T7 (giờ VN); NULL = mọi ngày
  hour_start       int  NOT NULL CHECK (hour_start BETWEEN 0 AND 23), -- khung [hour_start, hour_start+1) GIỜ VN
  thanh_budget_min int  NOT NULL DEFAULT 50,
  sono_budget_min  int  NOT NULL DEFAULT 90,                 -- 2 trạm; coupling thật để Phase 2
  online_quota_min int  NOT NULL DEFAULT 35,
  walkin_quota_min int  NOT NULL DEFAULT 10,
  buffer_min       int  NOT NULL DEFAULT 5,
  new_cap          int  NOT NULL DEFAULT 3,                  -- trần SỐ ca mới/khung (đòn phanh chính)
  max_total        int  NOT NULL DEFAULT 12,                 -- giữ điều kiện PK "tối đa 12 ca/giờ"
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE block_budget IS
  'Ngân sách tải/khung-giờ theo cơ sở. Con số seed là ước lượng, hiệu chỉnh từ visit.exam_completed_at sau 2-4 tuần.';

-- V2#7 — chống trùng cấu hình. NULL trong unique index không tự loại nhau ⇒ COALESCE
-- (doctor_id NULL→zero-uuid, weekday NULL→9) để 1 (cơ sở, BS, thứ, giờ) chỉ có đúng 1 dòng.
CREATE UNIQUE INDEX IF NOT EXISTS uq_block_budget_key ON block_budget (
  location_id,
  COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(weekday, 9),
  hour_start
);

COMMIT;
