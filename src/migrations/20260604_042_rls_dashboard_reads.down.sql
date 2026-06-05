-- Down 042: gỡ các policy SELECT authenticated đã thêm (giữ RLS ENABLED — gỡ
-- ENABLE có thể mở lại cho anon, nguy hiểm hơn). Re-runnable.

BEGIN;

DROP POLICY IF EXISTS cskh_action_select_authenticated ON cskh_action;
DROP POLICY IF EXISTS service_log_select_authenticated ON service_log;
DROP POLICY IF EXISTS staff_task_select_authenticated ON staff_task;
DROP POLICY IF EXISTS prescription_select_authenticated ON prescription;
DROP POLICY IF EXISTS patient_medical_profile_select_authenticated ON patient_medical_profile;
DROP POLICY IF EXISTS work_session_select_authenticated ON work_session;
DROP POLICY IF EXISTS event_log_select_authenticated ON event_log;
DROP POLICY IF EXISTS work_session_staff_select_authenticated ON work_session_staff;

COMMIT;
