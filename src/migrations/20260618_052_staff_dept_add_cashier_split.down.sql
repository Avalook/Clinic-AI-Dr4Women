-- Down 052: khôi phục CHECK staff_primary_department_check bản 050 (9 value, KHÔNG
-- CASHIER_THUOC/CASHIER_DV). Rollback CHỈ an toàn khi KHÔNG còn staff nào
-- primary_department IN ('CASHIER_THUOC','CASHIER_DV') — nếu còn sẽ lỗi (đúng ý
-- "trả về trạng thái trước migration").

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
    'TKYK'::text,
    'TRUONG_CA'::text
  ]));

COMMIT;
