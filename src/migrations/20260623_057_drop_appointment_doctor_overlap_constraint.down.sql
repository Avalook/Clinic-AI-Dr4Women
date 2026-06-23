BEGIN;

-- Restore the old constraint (note that it may fail if there are existing overlapping slots)
ALTER TABLE appointment
ADD CONSTRAINT appointment_no_doctor_overlap
EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(slot_start, slot_end, '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

COMMIT;
