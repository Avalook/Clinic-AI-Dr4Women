-- Migration 042: vá NỐT lứa bảng bị "RLS ENABLED nhưng KHÔNG có policy" → mọi
-- read qua PostgREST (authenticated) im lặng trả 0 dòng. Giống hệt lỗi migration
-- 032 đã vá cho staff/service_type/clinic_location/pregnancy, nhưng các bảng dưới
-- (tạo ở migration 029/030/031/035/038… hoặc bật RLS tay trên Supabase) bị SÓT.
--
-- TRIỆU CHỨNG đã xác minh trên DB thật (read-only):
--   cskh_action  RLS=on, policy SELECT = 0  → board "Nhật ký CSKH" rỗng dù có data
--   service_log  RLS=on, policy SELECT = 0  → board "Dịch vụ" rỗng
--   staff_task   RLS=on, policy SELECT = 0  → "Việc đang chờ làm" luôn = 0
-- (data VẪN được ghi đúng qua service-role; chỉ ĐỌC bằng authenticated bị chặn →
--  trông như "các bảng không đồng bộ với nhau".)
--
-- Mở SELECT CHỈ cho role `authenticated` (phiên đăng nhập phòng khám) — anon
-- (internet, chưa login) VẪN không đọc được. Re-runnable: DROP POLICY IF EXISTS.

BEGIN;

-- cskh_action (Nhật ký CSKH — board /tasks bảng 2)
ALTER TABLE cskh_action ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cskh_action_select_authenticated ON cskh_action;
CREATE POLICY cskh_action_select_authenticated
  ON cskh_action FOR SELECT TO authenticated USING (true);

-- service_log (Dịch vụ — board hàng đợi dịch vụ)
ALTER TABLE service_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_log_select_authenticated ON service_log;
CREATE POLICY service_log_select_authenticated
  ON service_log FOR SELECT TO authenticated USING (true);

-- staff_task (Việc đang chờ làm — stat card Trang chủ + board task)
ALTER TABLE staff_task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_task_select_authenticated ON staff_task;
CREATE POLICY staff_task_select_authenticated
  ON staff_task FOR SELECT TO authenticated USING (true);

-- prescription (Kê thuốc — board kê thuốc + hồ sơ lâm sàng)
ALTER TABLE prescription ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prescription_select_authenticated ON prescription;
CREATE POLICY prescription_select_authenticated
  ON prescription FOR SELECT TO authenticated USING (true);

-- patient_medical_profile (tiền sử BN — hồ sơ lâm sàng bác sĩ)
ALTER TABLE patient_medical_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patient_medical_profile_select_authenticated ON patient_medical_profile;
CREATE POLICY patient_medical_profile_select_authenticated
  ON patient_medical_profile FOR SELECT TO authenticated USING (true);

-- work_session (ca làm việc — tham chiếu lịch)
ALTER TABLE work_session ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_session_select_authenticated ON work_session;
CREATE POLICY work_session_select_authenticated
  ON work_session FOR SELECT TO authenticated USING (true);

-- event_log (nhật ký audit — 1 màn đọc lại)
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_log_select_authenticated ON event_log;
CREATE POLICY event_log_select_authenticated
  ON event_log FOR SELECT TO authenticated USING (true);

-- work_session_staff (số nhân sự mỗi ca — cột "Số staff" của lịch/ca trực; lỗi
-- audit nêu "Số staff lặng lẽ về 0" khi bật RLS mà thiếu policy).
ALTER TABLE work_session_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_session_staff_select_authenticated ON work_session_staff;
CREATE POLICY work_session_staff_select_authenticated
  ON work_session_staff FOR SELECT TO authenticated USING (true);

COMMIT;
