-- Mở quyền SELECT bảng clinical_record cho staff đã đăng nhập.
-- Pattern: mirror 020 — anon deny, authenticated allow SELECT only.
-- Bối cảnh: clinical_record chứa nội dung khám tự do (chuẩn đoán, lời dặn).
-- Trước khi sync Notion → Supabase, phải đóng nguy cơ public SELECT.

ALTER TABLE clinical_record ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_record_select_authenticated ON clinical_record;
CREATE POLICY clinical_record_select_authenticated
  ON clinical_record
  FOR SELECT
  TO authenticated
  USING (true);
