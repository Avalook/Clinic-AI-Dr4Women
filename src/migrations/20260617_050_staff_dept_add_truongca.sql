-- Thêm 'TRUONG_CA' (Trưởng ca) vào CHECK staff_primary_department_check
-- (T-DASH-TRUONGCA-01). Trưởng ca = vai HÀNH CHÍNH (sửa intake + hồ sơ hành chính
-- như Lễ tân/CSKH), TUYỆT ĐỐI KHÔNG lâm sàng. Vai thêm ở app (roles.ts) nhưng
-- CHECK cũ (049 = 8 value) chặn → staff không thể có primary_department='TRUONG_CA'.
-- List value GIỮ NGUYÊN 8 value hiện tại (...TKYK) + THÊM 'TRUONG_CA' = 9.
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
    'TKYK'::text,
    'TRUONG_CA'::text
  ]));

COMMIT;
