-- Rollback: gỡ policy SELECT cho authenticated trên bảng clinical_record.

DROP POLICY IF EXISTS clinical_record_select_authenticated ON clinical_record;
