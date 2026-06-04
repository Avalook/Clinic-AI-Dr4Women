-- Down 041: revert appointment.status CHECK to the pre-CSKH_CONFIRMED set.
--
-- Any rows still in CSKH_CONFIRMED must be migrated first, otherwise the
-- narrowed constraint re-add fails, e.g.:
--   UPDATE appointment SET status='SCHEDULED' WHERE status='CSKH_CONFIRMED';

ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN (
    'SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED',
    'NO_SHOW','CANCELLED','DOCTOR_DECLINED'
  ));
