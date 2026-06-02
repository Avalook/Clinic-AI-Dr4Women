-- Nhật ký CSKH theo từng lượt khám (gọi xác nhận → đến → XN → phân loại KQ →
-- gọi trả KQ → hẹn chăm sóc tiếp). Gắn vào bệnh nhân qua clinic_patient_id
-- (khớp theo SĐT khi import). Ghi qua service-role/import. RLS: SELECT
-- cho authenticated. Chứa PII (tên+SĐT) — không export ra repo.

BEGIN;

CREATE TABLE IF NOT EXISTS cskh_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID REFERENCES patient(clinic_patient_id) ON DELETE SET NULL,
    work_date DATE,
    slot_time TEXT,
    visit_number TEXT,
    patient_info TEXT,
    phone TEXT,
    visit_type TEXT,
    confirmed BOOLEAN,
    confirmed_by TEXT,
    arrived BOOLEAN,
    has_test BOOLEAN,
    tests TEXT,
    result_eta TEXT,
    result_group TEXT,
    cskh_status TEXT,
    cskh_followup TEXT,
    last_cskh_date DATE,
    cskh_by TEXT,
    note TEXT,
    source_month TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cskh_log_patient ON cskh_log (clinic_patient_id);
CREATE INDEX IF NOT EXISTS idx_cskh_log_date ON cskh_log (work_date DESC);

COMMENT ON TABLE cskh_log IS 'Nhật ký CSKH theo lượt khám, gắn theo bệnh nhân (khớp SĐT)';

ALTER TABLE cskh_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cskh_log_select_authenticated ON cskh_log;
CREATE POLICY cskh_log_select_authenticated
  ON cskh_log FOR SELECT TO authenticated USING (true);

COMMIT;
