-- Rollback: gỡ policy SELECT cho authenticated trên bảng appointment.

DROP POLICY IF EXISTS appointment_select_authenticated ON appointment;
