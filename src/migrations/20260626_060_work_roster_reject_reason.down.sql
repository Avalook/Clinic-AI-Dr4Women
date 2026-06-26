BEGIN;

ALTER TABLE work_roster DROP COLUMN IF EXISTS reject_reason;

NOTIFY pgrst, 'reload schema';

COMMIT;
