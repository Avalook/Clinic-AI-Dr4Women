-- Down 050: khôi phục CHECK staff_primary_department_check bản 049 (8 value, KHÔNG TRUONG_CA).
-- Rollback CHỈ an toàn khi KHÔNG còn staff nào primary_department='TRUONG_CA' (nếu có sẽ
-- lỗi vì constraint cũ không cho phép) — đúng ý "trả về trạng thái trước migration".

BEGIN;

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_primary_department_check;
ALTER TABLE staff ADD CONSTRAINT staff_primary_department_check
  CHECK (primary_department = ANY (ARRAY[
    'DOCTOR'::text,
    'ULTRASOUND_DOCTOR'::text,
    'NURSE_ULTRASOUND'::text,
    'RECEPTION'::text,
    'CSKH'::text,
    'MANAGEMENT'::text,
    'CASHIER'::text,
    'TKYK'::text
  ]));

COMMIT;
