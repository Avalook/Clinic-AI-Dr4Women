-- Mở quyền SELECT bảng visit cho staff đã đăng nhập (dashboard Phase 1 read-only).
-- Pattern: mirror 020 (RLS patient) — anon deny, authenticated allow SELECT only.
-- Phạm vi: CHỈ SELECT, CHỈ role authenticated. KHÔNG mở anon, KHÔNG mở ghi.
-- Siết theo staff_id / location_id: hoãn tới P11 (RBAC thật) — D-doctor-scope.
-- Bối cảnh: trước khi LOAD data BN thật vào Supabase qua Notion sync (P3),
-- mọi bảng PII phải có policy authenticated; nếu không, dashboard rỗng và
-- ngược lại bất kỳ ai có anon_key sẽ kéo được lịch sử khám BN.

ALTER TABLE visit ENABLE ROW LEVEL SECURITY;  -- idempotent

DROP POLICY IF EXISTS visit_select_authenticated ON visit;
CREATE POLICY visit_select_authenticated
  ON visit
  FOR SELECT
  TO authenticated
  USING (true);
