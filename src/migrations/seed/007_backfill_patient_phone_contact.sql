-- Backfill patient_contact_channel từ patient.phone_primary hiện có.
-- Mỗi BN có phone_primary → 1 dòng PHONE primary (is_primary=TRUE).
--
-- Re-runnable: dùng WHERE NOT EXISTS so we don't double-insert nếu seed
-- chạy lại sau khi lượt BN mới nhập. is_verified=FALSE vì phone chỉ
-- được verify khi CSKH gọi xác nhận.

BEGIN;

INSERT INTO patient_contact_channel (
    clinic_patient_id, channel_type, channel_value,
    is_primary, is_verified
)
SELECT
    p.clinic_patient_id,
    'PHONE',
    p.phone_primary,
    TRUE,
    FALSE
FROM patient p
WHERE p.phone_primary IS NOT NULL
  AND p.phone_primary <> ''
  AND NOT EXISTS (
    SELECT 1 FROM patient_contact_channel pcc
    WHERE pcc.clinic_patient_id = p.clinic_patient_id
      AND pcc.channel_type = 'PHONE'
      AND pcc.channel_value = p.phone_primary
  );

-- phone_secondary cũng vào (không primary).
INSERT INTO patient_contact_channel (
    clinic_patient_id, channel_type, channel_value,
    is_primary, is_verified
)
SELECT
    p.clinic_patient_id,
    'PHONE',
    p.phone_secondary,
    FALSE,
    FALSE
FROM patient p
WHERE p.phone_secondary IS NOT NULL
  AND p.phone_secondary <> ''
  AND NOT EXISTS (
    SELECT 1 FROM patient_contact_channel pcc
    WHERE pcc.clinic_patient_id = p.clinic_patient_id
      AND pcc.channel_type = 'PHONE'
      AND pcc.channel_value = p.phone_secondary
  );

COMMIT;
