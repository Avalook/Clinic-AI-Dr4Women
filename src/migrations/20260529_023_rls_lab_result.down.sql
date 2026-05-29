-- Rollback: gỡ policy SELECT cho authenticated trên bảng lab_result.

DROP POLICY IF EXISTS lab_result_select_authenticated ON lab_result;
