BEGIN;

-- Drop the old constraint that restricts doctor to only 1 appointment at a time
ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_no_doctor_overlap;

COMMIT;
