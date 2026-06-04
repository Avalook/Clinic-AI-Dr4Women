-- Migration 041: add CSKH_CONFIRMED to appointment.status.
--
-- Two-step confirmation. CSKH confirms WITH THE PATIENT (SCHEDULED →
-- CSKH_CONFIRMED) but the appointment still awaits the DOCTOR's own decision:
--   doctor confirm:  SCHEDULED | CSKH_CONFIRMED → CONFIRMED
--   doctor reject:   SCHEDULED | CSKH_CONFIRMED → DOCTOR_DECLINED
-- so a CSKH-confirmed slot keeps showing in the doctor's "Chờ xác nhận" column
-- (with Confirm / Reject), and a doctor reject surfaces to CSKH as cancelled.
--
-- The status CHECK is the inline column constraint auto-named
-- `appointment_status_check` (`<table>_<column>_check`). Re-runnable: drop by
-- that name, re-add the widened set.

ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN (
    'SCHEDULED','CSKH_CONFIRMED','CONFIRMED','CHECKED_IN','COMPLETED',
    'NO_SHOW','CANCELLED','DOCTOR_DECLINED'
  ));
