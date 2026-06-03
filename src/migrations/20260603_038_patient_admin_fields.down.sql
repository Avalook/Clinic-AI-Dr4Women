-- Rollback migration 038: gỡ các cột hành chính bổ sung trên `patient`.

BEGIN;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_gender_check;

ALTER TABLE patient
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS ethnicity,
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS occupation,
  DROP COLUMN IF EXISTS patient_objection,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS guardian_name;

COMMIT;
