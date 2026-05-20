BEGIN;

ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_no_doctor_overlap;

COMMIT;
