-- Thêm 'TKYK' (Thư ký Y khoa) vào CHECK staff_primary_department_check
-- (T-DASH-TKYK-CLINICAL-01). Recap 17/6: hồ sơ lâm sàng = Bác sĩ + Điều dưỡng +
-- Thư ký Y khoa. Vai TKYK thêm ở app (roles.ts) nhưng CHECK cũ (047 = 7 value)
-- chặn → staff không thể có primary_department='TKYK'. Bổ sung để gán được.
-- List value GIỮ NGUYÊN 7 value hiện tại (...CASHIER) + THÊM 'TKYK' = 8.
-- KHÔNG đụng constraint/bảng khác, KHÔNG enum, KHÔNG 043.

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
