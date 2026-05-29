-- Rollback: gỡ policy SELECT cho authenticated trên bảng visit.
-- KHÔNG tắt RLS (relrowsecurity giữ nguyên trạng thái trước migration).

DROP POLICY IF EXISTS visit_select_authenticated ON visit;
