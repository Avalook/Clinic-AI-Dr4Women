-- Down migration 018: drop patient_summary VIEW + ultrasound_record table
DROP VIEW IF EXISTS patient_summary;

DROP TRIGGER IF EXISTS ultrasound_record_set_updated_at ON ultrasound_record;
DROP INDEX IF EXISTS idx_ultrasound_patient;
DROP INDEX IF EXISTS idx_ultrasound_visit;
DROP TABLE IF EXISTS ultrasound_record;
