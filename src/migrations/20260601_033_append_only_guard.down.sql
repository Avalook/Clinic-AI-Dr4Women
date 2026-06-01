-- Rollback: remove the append-only guard on patient + appointment.

BEGIN;

DROP TRIGGER IF EXISTS trg_appointment_no_truncate ON appointment;
DROP TRIGGER IF EXISTS trg_appointment_no_delete ON appointment;
DROP TRIGGER IF EXISTS trg_patient_no_truncate ON patient;
DROP TRIGGER IF EXISTS trg_patient_no_delete ON patient;

DROP FUNCTION IF EXISTS prevent_hard_delete();

COMMIT;
