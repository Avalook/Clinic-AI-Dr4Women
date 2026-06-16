-- Down 047: khôi phục CHECK staff_primary_department_check bản CŨ (6 value, KHÔNG CASHIER).
-- Lưu ý: rollback chỉ an toàn khi KHÔNG còn staff nào dept='CASHIER' (nếu có sẽ lỗi
-- vì constraint mới không cho phép) — đúng ý "trả về trạng thái trước migration".

BEGIN;

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_primary_department_check;
ALTER TABLE staff ADD CONSTRAINT staff_primary_department_check
  CHECK (primary_department = ANY (ARRAY[
    'DOCTOR'::text,
    'ULTRASOUND_DOCTOR'::text,
    'NURSE_ULTRASOUND'::text,
    'RECEPTION'::text,
    'CSKH'::text,
    'MANAGEMENT'::text
  ]));

COMMIT;
