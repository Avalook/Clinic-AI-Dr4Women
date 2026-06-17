-- Thêm 'CASHIER_THUOC' + 'CASHIER_DV' vào CHECK staff_primary_department_check
-- (T-DASH-CASHIER-SPLIT-01). Tách 2 thu ngân (thuốc ⟂ dịch vụ) thành 2 vai HÀNH
-- CHÍNH riêng — mỗi người 1 tài khoản, chỉ thấy màn của mình. CASHIER cũ GIỮ
-- làm superset (Quản lý/admin xem cả hai). Vai thêm ở app (roles.ts) nhưng CHECK
-- 050 (9 value, ...TRUONG_CA) chặn → staff không thể có primary_department mới.
-- List = 9 value hiện tại + 2 = 11. KHÔNG đụng enum/bảng khác, KHÔNG 043, KHÔNG lâm sàng.

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
    'TRUONG_CA'::text,
    'CASHIER_THUOC'::text,
    'CASHIER_DV'::text
  ]));

COMMIT;
