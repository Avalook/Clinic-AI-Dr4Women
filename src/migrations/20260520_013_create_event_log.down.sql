-- Down Migration: Drop triggers, functions, and event_log table

DROP TRIGGER IF EXISTS trg_event_log_no_truncate ON event_log;
DROP TRIGGER IF EXISTS trg_event_log_no_delete ON event_log;
DROP TRIGGER IF EXISTS trg_event_log_no_update ON event_log;
DROP FUNCTION IF EXISTS enforce_append_only();
DROP TABLE IF EXISTS event_log;
