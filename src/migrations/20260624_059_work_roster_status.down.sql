BEGIN;

DROP INDEX IF EXISTS idx_work_roster_week_status;
ALTER TABLE work_roster DROP COLUMN IF EXISTS status;

COMMIT;
