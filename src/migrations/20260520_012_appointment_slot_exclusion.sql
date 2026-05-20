BEGIN;

-- Enable btree_gist for GIST index on UUID + tstzrange combo
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent double-booking same doctor in overlapping time slots
-- Excludes CANCELLED and NO_SHOW (re-bookable after cancel)
ALTER TABLE appointment
ADD CONSTRAINT appointment_no_doctor_overlap
EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(slot_start, slot_end, '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

COMMENT ON CONSTRAINT appointment_no_doctor_overlap ON appointment IS
'Medical Safety Gate: prevents double-booking same doctor.
Time range is half-open [start, end) so adjacent slots (10:00-10:30 + 10:30-11:00) are allowed.
CANCELLED/NO_SHOW appointments excluded — slots become re-bookable after cancellation.';

COMMIT;
