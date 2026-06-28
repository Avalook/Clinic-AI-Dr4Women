-- Down for 061 — Capacity Phase 1.
BEGIN;

DROP INDEX IF EXISTS uq_block_budget_key;
DROP TABLE IF EXISTS block_budget;

ALTER TABLE appointment
  DROP COLUMN IF EXISTS patient_kind,
  DROP COLUMN IF EXISTS thanh_min,
  DROP COLUMN IF EXISTS sono_min,
  DROP COLUMN IF EXISTS need_sono;

COMMIT;
