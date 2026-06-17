-- Thêm 'Khác' vào CHECK patient_gender_check (T-DASH-GENDER-KHAC-02 / D13).
-- Constraint sinh ở migration 038 chỉ cho 'Nam'/'Nữ' (cho NULL) → phòng khám yêu
-- cầu có thêm lựa chọn "Khác". DROP+RECREATE ĐÚNG 1 constraint patient_gender_check,
-- GIỮ NGUYÊN dạng cho phép NULL + giá trị 'Nam'/'Nữ' đang lưu. KHÔNG đụng cột /
-- constraint khác, KHÔNG enum, KHÔNG 043.

BEGIN;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_gender_check;
ALTER TABLE patient ADD CONSTRAINT patient_gender_check
  CHECK (gender IS NULL OR gender IN ('Nam', 'Nữ', 'Khác'));

COMMENT ON COLUMN patient.gender IS 'Giới tính: Nam/Nữ/Khác (mục I.3 form khám)';

COMMIT;
