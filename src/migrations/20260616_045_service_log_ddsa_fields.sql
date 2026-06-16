-- Bổ sung TỐI THIỂU cho service_log phục vụ màn ĐD siêu âm (T-DASH-DDSA-A01).
-- Lý do (khảo sát STEP 1): service_log đang TRỐNG, KHÔNG có cột phân loại SA/XN,
-- và 3 mốc ordered/started/finished mang nghĩa import (ordered_at = "giờ chỉ định")
-- nên KHÔNG map sạch sang "lấy mẫu / gửi lab / có KQ".
--   - kind: phân biệt dòng SA (siêu âm) vs XN (xét nghiệm) cho 2 hàng đợi riêng.
--   - sent_to_lab_at: mốc GIỮA "đã gửi lab" cho hàng đợi XN 3 trạng thái.
--     Map XN: lấy mẫu = started_at · gửi lab = sent_to_lab_at · có KQ = finished_at.
--     (ordered_at GIỮ NGUYÊN nghĩa "giờ chỉ định" từ import — KHÔNG đụng.)
-- KHÔNG đụng lab_result, KHÔNG đụng visit. service_log KHÔNG nằm nhóm append-only.

BEGIN;

ALTER TABLE service_log
    ADD COLUMN IF NOT EXISTS kind TEXT,
    ADD COLUMN IF NOT EXISTS sent_to_lab_at TIMESTAMPTZ;

-- kind chỉ nhận 'SA' / 'XN' (NULL = dòng import cũ chưa phân loại).
ALTER TABLE service_log DROP CONSTRAINT IF EXISTS service_log_kind_check;
ALTER TABLE service_log ADD CONSTRAINT service_log_kind_check
    CHECK (kind IS NULL OR kind IN ('SA', 'XN'));

CREATE INDEX IF NOT EXISTS idx_service_log_kind
    ON service_log (kind)
    WHERE kind IS NOT NULL;

COMMENT ON COLUMN service_log.kind IS
    'Phân loại dòng cho màn ĐD siêu âm: SA (siêu âm) | XN (xét nghiệm). NULL = chưa phân loại.';
COMMENT ON COLUMN service_log.sent_to_lab_at IS
    'Mốc "đã gửi lab" (giữa lấy mẫu và có KQ) cho hàng đợi XN 3 trạng thái.';

COMMIT;
