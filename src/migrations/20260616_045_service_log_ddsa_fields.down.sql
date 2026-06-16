-- Down 045: gỡ cột kind + sent_to_lab_at (và constraint/index đi kèm) khỏi service_log.
BEGIN;

ALTER TABLE service_log DROP CONSTRAINT IF EXISTS service_log_kind_check;
DROP INDEX IF EXISTS idx_service_log_kind;

ALTER TABLE service_log
    DROP COLUMN IF EXISTS sent_to_lab_at,
    DROP COLUMN IF EXISTS kind;

COMMIT;
