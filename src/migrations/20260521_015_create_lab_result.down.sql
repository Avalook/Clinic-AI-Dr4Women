-- Down migration 015
DROP TRIGGER IF EXISTS lab_result_set_updated_at ON lab_result;
DROP INDEX IF EXISTS idx_lab_result_appointment;
DROP INDEX IF EXISTS idx_lab_result_safety_gate;
DROP INDEX IF EXISTS idx_lab_result_triage_pending;
DROP INDEX IF EXISTS idx_lab_result_patient;
DROP TABLE IF EXISTS lab_result;
