-- Thêm 'CASHIER' vào CHECK staff_primary_department_check (T-FIX-CASHIER-CHECK-047).
-- Vai CASHIER đã thêm ở app (roles.ts, Packet 2) nhưng CHECK cũ (migration 008) chặn
-- → staff không thể có primary_department='CASHIER'. Bổ sung để vai CASHIER dùng được.
-- List value GIỮ NGUYÊN từ CHECK hiện tại (6 value) + THÊM 'CASHIER' = 7 value
-- (khớp ALL_ROLES). KHÔNG đụng constraint/bảng khác, KHÔNG enum, KHÔNG 043.

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
    'CASHIER'::text
  ]));

COMMIT;
