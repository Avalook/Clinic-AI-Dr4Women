-- Phase 1 Onboard / Nhóm 1 — BookingChannel.
-- Đóng 1/3 nợ Phase 1 từ SYSTEM_STATE_ACTUAL §2.1 ("3 nợ Phase-1:
-- patient_contact_channel + booking_channel + patient_next_of_kin").
--
-- Trước migration này, appointment.booking_channel được lưu dưới dạng
-- TEXT (raw, không FK, không CHECK enum) gây drift "Zalo"/"zalo"/"FB".
-- Phase 2 sẽ thay cột TEXT đó bằng FK booking_channel_id; v1 chỉ tạo
-- bảng + seed 7 kênh mặc định để code mới có target.
--
-- Schema theo Onboard-phase1.md Nhóm 1 / BookingChannel:
--   channel_id UUID PK + channel_code UNIQUE + channel_name +
--   channel_category + is_active + created_at.

BEGIN;

CREATE TABLE IF NOT EXISTS booking_channel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('ZALO','FACEBOOK','HOTLINE','WALK_IN','REFERRAL','OTHER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_channel_category ON booking_channel (category);
CREATE INDEX IF NOT EXISTS idx_booking_channel_active ON booking_channel (is_active) WHERE is_active = TRUE;

COMMENT ON TABLE booking_channel IS 'Phase 1 master — kênh BN biết đến/đặt lịch với PK (Zalo, FB, Hotline, Walk-in, Referral).';
COMMENT ON COLUMN booking_channel.id IS 'PK kỹ thuật (channel_id trong Onboard doc).';
COMMENT ON COLUMN booking_channel.code IS 'Mã ngắn cố định (ZALO_PK, FB_DR4WOMEN, HOTLINE, WALK_IN, ...).';
COMMENT ON COLUMN booking_channel.name IS 'Tên hiển thị (CSKH thấy khi chọn kênh lúc đặt lịch).';
COMMENT ON COLUMN booking_channel.category IS 'Nhóm kênh (ZALO/FACEBOOK/HOTLINE/WALK_IN/REFERRAL/OTHER) — dùng cho report ROI marketing.';

COMMIT;
