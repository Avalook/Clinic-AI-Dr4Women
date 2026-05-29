-- Rollback BookingChannel. KHÔNG có FK trỏ tới bảng này trong v1 (chưa
-- ALTER appointment.booking_channel TEXT → FK), nên DROP an toàn.

DROP INDEX IF EXISTS idx_booking_channel_active;
DROP INDEX IF EXISTS idx_booking_channel_category;
DROP TABLE IF EXISTS booking_channel;
