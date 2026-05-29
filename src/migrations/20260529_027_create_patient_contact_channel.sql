-- Phase 1 Onboard / Nhóm 2 — PatientContactChannel.
-- Đóng 2/3 nợ Phase 1 từ SYSTEM_STATE_ACTUAL §2.1.
--
-- Lưu mọi kênh PK có thể nhắn tới 1 BN: ZALO uid, PHONE, FACEBOOK psid,
-- EMAIL. Thay cho 2 cột TEXT phone_primary/secondary trên bảng patient
-- — schema cũ không lưu được Zalo uid (chặn Zalo routing Phase 3).
--
-- Schema theo Onboard-phase1.md Nhóm 2 / PatientContactChannel.

BEGIN;

CREATE TABLE IF NOT EXISTS patient_contact_channel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL
        CHECK (channel_type IN ('ZALO','PHONE','FACEBOOK','EMAIL','OTHER')),
    channel_value TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Một (BN, loại kênh, giá trị) chỉ link 1 lần — tránh trùng số/uid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_contact_channel_uniq
    ON patient_contact_channel (clinic_patient_id, channel_type, channel_value);

-- Mỗi BN nên có đúng 1 kênh primary (partial UNIQUE on is_primary = TRUE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_contact_channel_primary
    ON patient_contact_channel (clinic_patient_id)
    WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_patient_contact_channel_lookup
    ON patient_contact_channel (channel_type, channel_value);

COMMENT ON TABLE patient_contact_channel IS 'Phase 1 — kênh liên lạc của 1 BN (Zalo uid / số điện thoại / FB psid / email). 1 BN có thể có nhiều dòng. Phase 3 dùng để route thông báo Zalo trước, fallback Phone.';
COMMENT ON COLUMN patient_contact_channel.channel_type IS 'ZALO / PHONE / FACEBOOK / EMAIL / OTHER.';
COMMENT ON COLUMN patient_contact_channel.channel_value IS 'Zalo: zalo_user_id. Phone: số E.164 chuẩn. FB: PSID. Email: địa chỉ.';
COMMENT ON COLUMN patient_contact_channel.is_verified IS 'Zalo/FB: đã nhắn ít nhất 1 lần. Phone: đã gọi xác nhận.';
COMMENT ON COLUMN patient_contact_channel.is_primary IS 'Kênh ưu tiên gửi thông báo — partial UNIQUE enforce 1 primary per BN.';

COMMIT;
