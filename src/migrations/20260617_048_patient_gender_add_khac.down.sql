-- Down 048: khôi phục CHECK patient_gender_check bản 038 (chỉ 'Nam'/'Nữ', cho NULL).
-- Rollback CHỈ an toàn khi KHÔNG còn patient nào gender='Khác' (nếu có sẽ lỗi vì
-- constraint cũ không cho phép) — đúng ý "trả về trạng thái trước migration".

BEGIN;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_gender_check;
ALTER TABLE patient ADD CONSTRAINT patient_gender_check
  CHECK (gender IS NULL OR gender IN ('Nam', 'Nữ'));

COMMENT ON COLUMN patient.gender IS 'Giới tính: Nam/Nữ (mục I.3 form khám)';

COMMIT;
