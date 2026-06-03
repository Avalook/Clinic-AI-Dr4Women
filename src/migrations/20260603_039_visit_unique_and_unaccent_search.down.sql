-- Rollback 039.
DROP INDEX IF EXISTS idx_patient_full_name_unaccent;
ALTER TABLE patient DROP COLUMN IF EXISTS full_name_unaccent;
DROP FUNCTION IF EXISTS f_unaccent(text);
DROP INDEX IF EXISTS uq_visit_appointment_id;
-- (Giữ extension unaccent/pg_trgm — có thể dùng nơi khác.)
