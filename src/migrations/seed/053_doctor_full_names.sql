-- Cập nhật staff.full_name từ TÊN TẮT (nguồn Notion) → TÊN ĐẦY ĐỦ có học hàm
-- (T-DASH-DOCTOR-CLEANUP-01, theo bảng map PK cung cấp). CHỈ đổi giá trị full_name
-- của 17 bác sĩ (DOCTOR + ULTRASOUND_DOCTOR). KHÔNG đụng cấu trúc, KHÔNG đụng
-- short_name (giữ làm khóa ổn định), KHÔNG đụng bảng khác.
--
-- IDEMPOTENT: WHERE khớp full_name = TÊN TẮT cũ → chạy lần 2 khớp 0 row (vô hại).
-- ROLLBACK: chạy lại với cặp (new, old) đảo ngược — short_name vẫn là tên gốc nên
--   tra cứu được giá trị cũ (vd short_name='Thành' ⇒ full_name cũ='BS Thành').
--   Bảng đảo ngược lưu trong CHANGELOG entry T-DASH-DOCTOR-CLEANUP-01.

BEGIN;

UPDATE staff AS s
SET full_name = m.new_name,
    updated_at = now()
FROM (VALUES
  ('BS Linh Nam khoa', 'BSNT. Nguyễn Khánh Linh'),
  ('BS Thành',         'TS.BS. Phan Chí Thành'),
  ('BS Hằng',          'Ths.BS. Phan Thu Hằng'),
  ('BS SA Bá Linh',    'Ths. Đào Bá Linh'),
  ('BS SA Đạt',        'BS. Nguyễn Thành Đạt'),
  ('BS SA Minh',       'BS. Phạm Ngọc Minh'),
  ('BS SA Hoàng',      'Ths. Nguyễn Mạnh Minh Hoàng'),
  ('BS SA Tiến',       'BS. Nguyễn Trung Tiến'),
  ('BS Nam',           'BSNT. Nguyễn Phương Nam'),
  ('BS Hùng',          'BSNT. Vũ Trọng Hùng'),
  ('BS Thủy',          'BS. Thủy'),
  ('BS Vân',           'BS. Vân'),
  ('BS SA Giáp',       'BSNT. Nguyễn Hữu Giáp'),
  ('BS Thiệp',         'BSNT. Hoàng Đình Thiệp'),
  ('BS Thuận',         'BSCKI. Thuận'),
  ('BS Quyết',         'BSNT. Lê Thiệu Quyết'),
  ('BS Nghị',          'BS. Phạm Văn Nghị')
) AS m(old_name, new_name)
WHERE s.full_name = m.old_name
  AND s.primary_department IN ('DOCTOR', 'ULTRASOUND_DOCTOR');

COMMIT;
