-- Down 043: gỡ các trigger append-only đã thêm cho clinical_record/visit/lab_result.
-- KHÔNG xoá hàm prevent_hard_delete() (033 sở hữu, còn dùng cho patient/appointment).
-- Re-runnable.

BEGIN;

DROP TRIGGER IF EXISTS trg_clinical_record_no_delete ON clinical_record;
DROP TRIGGER IF EXISTS trg_clinical_record_no_truncate ON clinical_record;
DROP TRIGGER IF EXISTS trg_visit_no_delete ON visit;
DROP TRIGGER IF EXISTS trg_visit_no_truncate ON visit;
DROP TRIGGER IF EXISTS trg_lab_result_no_delete ON lab_result;
DROP TRIGGER IF EXISTS trg_lab_result_no_truncate ON lab_result;

COMMIT;
