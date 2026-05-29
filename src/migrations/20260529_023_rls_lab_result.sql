-- Mở quyền SELECT bảng lab_result cho staff đã đăng nhập.
-- Pattern: mirror 020 — anon deny, authenticated allow SELECT only.
-- Bối cảnh: lab_result có kết quả XN (chỉ số sinh hoá, vi sinh). Highly sensitive.

ALTER TABLE lab_result ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_result_select_authenticated ON lab_result;
CREATE POLICY lab_result_select_authenticated
  ON lab_result
  FOR SELECT
  TO authenticated
  USING (true);
