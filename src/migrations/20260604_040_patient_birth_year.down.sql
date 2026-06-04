BEGIN;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_birth_year_check;
ALTER TABLE patient DROP COLUMN IF EXISTS birth_year;

COMMIT;
