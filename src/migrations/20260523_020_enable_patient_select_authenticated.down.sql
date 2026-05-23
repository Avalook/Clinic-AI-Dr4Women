-- Rollback: gỡ policy SELECT cho authenticated.
-- KHÔNG tắt RLS: bảng patient đã có relrowsecurity=true TRƯỚC migration 020,
-- không phải migration này bật nên không có thẩm quyền tắt.

DROP POLICY IF EXISTS patient_select_authenticated ON patient;
