-- Down migration 019: drop staff_capability
DROP INDEX IF EXISTS idx_staff_capability_capability;
DROP INDEX IF EXISTS idx_staff_capability_staff_id;
DROP TABLE IF EXISTS staff_capability;
