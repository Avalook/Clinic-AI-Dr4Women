-- Rollback migration: Remove event_published column and restore original append-only trigger
-- Target: Supabase / PostgreSQL database

BEGIN;

DROP INDEX IF EXISTS idx_event_log_unpublished;

ALTER TABLE event_log DROP COLUMN IF EXISTS event_published;

-- Restore original enforce_append_only function
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'event_log is append-only: UPDATE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'event_log is append-only: DELETE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'event_log is append-only: TRUNCATE not allowed'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
