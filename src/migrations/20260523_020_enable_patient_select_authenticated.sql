-- Mở quyền SELECT bảng patient cho staff đã đăng nhập (dashboard P7a, read-only).
-- Bối cảnh: RLS đã bật (relrowsecurity=true) nhưng 0 policy => deny-all => dashboard rỗng.
-- Phạm vi: CHỈ SELECT, CHỈ role authenticated. KHÔNG mở anon, KHÔNG mở ghi.
-- Siết theo location_id/staff scope: hoãn tới P11 khi có RBAC thật.
-- national_id_number không lộ thêm: query dashboard không select cột này.

ALTER TABLE patient ENABLE ROW LEVEL SECURITY;  -- idempotent, đã bật sẵn

DROP POLICY IF EXISTS patient_select_authenticated ON patient;
CREATE POLICY patient_select_authenticated
  ON patient
  FOR SELECT
  TO authenticated
  USING (true);
