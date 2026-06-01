-- Down 034: revert appointment.status CHECK to the pre-DOCTOR_DECLINED set.
-- Will FAIL if any row still holds 'DOCTOR_DECLINED' — re-assign or update
-- those rows first.

ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN (
    'SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED'
  ));
