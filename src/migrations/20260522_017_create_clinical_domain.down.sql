-- Down migration 017: drop D3 Clinical Domain
DROP TRIGGER IF EXISTS clinical_record_set_updated_at ON clinical_record;
DROP TRIGGER IF EXISTS visit_set_updated_at ON visit;
DROP TRIGGER IF EXISTS trg_visit_amendment_no_delete ON visit_amendment;
DROP TRIGGER IF EXISTS trg_visit_amendment_no_update ON visit_amendment;
DROP TRIGGER IF EXISTS trg_visit_finalized_block ON visit;

DROP FUNCTION IF EXISTS visit_amendment_append_only();
DROP FUNCTION IF EXISTS visit_finalized_block_update();

DROP INDEX IF EXISTS idx_visit_amendment_visit;
DROP INDEX IF EXISTS idx_visit_patient;

DROP TABLE IF EXISTS visit_amendment;
DROP TABLE IF EXISTS clinical_record;
DROP TABLE IF EXISTS visit;
