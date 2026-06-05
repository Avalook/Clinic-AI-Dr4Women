-- Down 032: gỡ các policy SELECT authenticated đã thêm cho bảng tham chiếu/lâm
-- sàng (giữ RLS ENABLED — gỡ ENABLE có thể mở lại cho anon, nguy hiểm hơn).
-- Khớp pattern 042.down. Re-runnable.

BEGIN;

DROP POLICY IF EXISTS staff_select_authenticated ON staff;
DROP POLICY IF EXISTS service_type_select_authenticated ON service_type;
DROP POLICY IF EXISTS clinic_location_select_authenticated ON clinic_location;
DROP POLICY IF EXISTS pregnancy_select_authenticated ON pregnancy;

COMMIT;
