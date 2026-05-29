-- Mở quyền SELECT bảng appointment cho staff đã đăng nhập.
-- Pattern: mirror 020 — anon deny, authenticated allow SELECT only.
-- Bối cảnh: appointment có FK patient_id + thông tin lịch hẹn cá nhân.

ALTER TABLE appointment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_select_authenticated ON appointment;
CREATE POLICY appointment_select_authenticated
  ON appointment
  FOR SELECT
  TO authenticated
  USING (true);
