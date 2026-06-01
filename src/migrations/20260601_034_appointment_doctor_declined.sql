-- Migration 034: add DOCTOR_DECLINED to appointment.status.
--
-- Doctors can now Confirm (SCHEDULED→CONFIRMED) or Reject (SCHEDULED→
-- DOCTOR_DECLINED) appointments assigned to them. A declined appointment keeps
-- its doctor_id (so it stays in that doctor's history) and surfaces to reception
-- /CSKH/management for re-assignment (re-assign flow is a later migration).
--
-- The status CHECK is an inline column constraint → Postgres auto-named it
-- `appointment_status_check` (`<table>_<column>_check`). Re-runnable: drop by
-- that name, re-add the widened set.

ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_status_check;
ALTER TABLE appointment ADD CONSTRAINT appointment_status_check
  CHECK (status IN (
    'SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED',
    'NO_SHOW','CANCELLED','DOCTOR_DECLINED'
  ));
