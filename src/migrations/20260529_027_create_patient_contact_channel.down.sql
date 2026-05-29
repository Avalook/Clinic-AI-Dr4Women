-- Rollback PatientContactChannel. CASCADE từ patient sẽ tự dọn child
-- rows; chỉ cần DROP bảng + index.

DROP INDEX IF EXISTS idx_patient_contact_channel_lookup;
DROP INDEX IF EXISTS idx_patient_contact_channel_primary;
DROP INDEX IF EXISTS idx_patient_contact_channel_uniq;
DROP TABLE IF EXISTS patient_contact_channel;
