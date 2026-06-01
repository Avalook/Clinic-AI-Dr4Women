-- Migration: Append-only guard for the operational write-path tables
-- `patient` and `appointment`.
--
-- Unlike `event_log` (true event-sourcing, enforce_append_only() blocks even
-- UPDATE), these two tables MUST allow UPDATE for their normal lifecycle:
--   - appointment.status: SCHEDULED → CONFIRMED → CHECKED_IN → COMPLETED /
--     NO_SHOW / CANCELLED  (cancellation is a status UPDATE, not a row delete)
--   - patient.is_active / updated_at  (deactivation is a soft flag)
-- So we forbid only HARD removal: a clinical row can NEVER be physically
-- DELETEd, and the tables can NEVER be TRUNCATEd. Every dashboard write is also
-- mirrored into the append-only event_log (src/dashboard/lib/event-log.ts).
--
-- Controlled ETL / seed maintenance (sync_to_supabase.py TRUNCATE-then-INSERT,
-- demo_seed.py --wipe) opts out per-transaction with:
--     SET LOCAL app.allow_hard_delete = 'on';
-- The dashboard / app paths never set this, so ad-hoc deletes stay blocked.

BEGIN;

CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Escape hatch for controlled ETL/seed jobs (see header). The custom GUC
    -- is unset on normal app connections → current_setting(..., true) = NULL.
    IF current_setting('app.allow_hard_delete', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;   -- allow the row delete to proceed
        END IF;
        RETURN NULL;       -- TRUNCATE (statement-level): return value ignored
    END IF;

    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            '% is append-only: DELETE not allowed — cancel via status / is_active update (row id kept for audit)',
            TG_TABLE_NAME
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION '% is append-only: TRUNCATE not allowed', TG_TABLE_NAME
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_hard_delete() IS
'Append-only guard for operational tables (patient, appointment): blocks
physical DELETE/TRUNCATE while leaving UPDATE free for lifecycle state changes.
Controlled ETL/seed sets `SET LOCAL app.allow_hard_delete = ''on''` to opt out.';

-- patient -------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_patient_no_delete ON patient;
CREATE TRIGGER trg_patient_no_delete
    BEFORE DELETE ON patient
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_patient_no_truncate ON patient;
CREATE TRIGGER trg_patient_no_truncate
    BEFORE TRUNCATE ON patient
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();

-- appointment ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_appointment_no_delete ON appointment;
CREATE TRIGGER trg_appointment_no_delete
    BEFORE DELETE ON appointment
    FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();

DROP TRIGGER IF EXISTS trg_appointment_no_truncate ON appointment;
CREATE TRIGGER trg_appointment_no_truncate
    BEFORE TRUNCATE ON appointment
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_hard_delete();

COMMIT;
