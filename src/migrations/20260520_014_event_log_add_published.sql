-- Migration: Add event_published column and update append-only trigger
-- Target: Supabase / PostgreSQL database

BEGIN;

-- Add event_published column if it does not exist
ALTER TABLE event_log
  ADD COLUMN IF NOT EXISTS event_published BOOLEAN NOT NULL DEFAULT FALSE;

-- Create partial index on unpublished events for outbox polling
CREATE INDEX IF NOT EXISTS idx_event_log_unpublished
  ON event_log (event_published)
  WHERE event_published = FALSE;

-- Comment on column
COMMENT ON COLUMN event_log.event_published IS
  'Outbox flag: FALSE=pending publish, TRUE=published to MQ';

-- Patch enforce_append_only to allow updates ONLY for event_published flipping from FALSE to TRUE
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'event_log is append-only: DELETE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'event_log is append-only: TRUNCATE not allowed'
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only allow flipping event_published from FALSE to TRUE.
        -- All other columns must remain unchanged.
        IF OLD.event_published = FALSE AND NEW.event_published = TRUE
           AND OLD.event_id = NEW.event_id
           AND OLD.event_type = NEW.event_type
           AND OLD.aggregate_id = NEW.aggregate_id
           AND OLD.payload = NEW.payload THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'event_log is append-only: UPDATE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
