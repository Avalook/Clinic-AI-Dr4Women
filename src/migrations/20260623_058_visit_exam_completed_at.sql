BEGIN;

-- Mốc "Khám xong" của lượt khám: lưu THỜI ĐIỂM appointment chuyển COMPLETED (bác sĩ
-- bấm "Lưu & Khám xong"). Phục vụ phân tích THỜI GIAN KHÁM = exam_completed_at −
-- checked_in_at, từ đó phân loại thời gian khám theo dịch vụ / loại khách để tối ưu
-- xếp lịch (yêu cầu PM cho board Lễ tân "Trạng thái BN buổi khám").
--
-- Các mốc khác ĐÃ CÓ SẴN, KHÔNG thêm cột thừa:
--   • bắt đầu khám  = visit.checked_in_at (mig 017)
--   • thanh toán    = payment.paid_at (mig 056)
-- Idempotent. KHÔNG đụng visit.status / FINALIZED / append-only (043).
ALTER TABLE visit ADD COLUMN IF NOT EXISTS exam_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN visit.exam_completed_at IS
    'Thời điểm khám xong (appointment COMPLETED). Mốc tiến trình buổi khám phục vụ phân tích thời gian khám.';

COMMIT;
