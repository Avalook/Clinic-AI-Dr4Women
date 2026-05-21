-- Down migration 016
DROP TRIGGER IF EXISTS staff_task_set_updated_at ON staff_task;
DROP INDEX IF EXISTS idx_staff_task_due;
DROP INDEX IF EXISTS idx_staff_task_source;
DROP INDEX IF EXISTS idx_staff_task_assigned;
DROP TABLE IF EXISTS staff_task;
