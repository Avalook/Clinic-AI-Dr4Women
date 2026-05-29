-- E2c — bảng service_log: log lần thực hiện dịch vụ cho BN.
-- Khác với ``service_type`` (master catalog): service_type = "Sản 1" định
-- nghĩa, ``service_log`` = "BN X dùng dịch vụ Sản 1 ngày Y bởi NV Z".
--
-- Nguồn: ``Data khách gửi/Dịch vụ/*_all.csv`` (~15.075 dòng).
-- Source ID format: "SERVICE-<n>".
--
-- Quan hệ:
--   - clinic_patient_id: extract_phone từ "CSDL bệnh nhân (lâm sàng)".
--   - service_type_id: best-effort lookup theo tên dịch vụ raw (PHASE 2
--     sẽ map alias). v1 lưu raw text; resolve khi có thể.
--   - visit_link_raw: text "PK<n>-... (URL)"; resolve sang visit.id sau.

BEGIN;

CREATE TABLE IF NOT EXISTS service_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ref TEXT UNIQUE NOT NULL,
    clinic_patient_id UUID REFERENCES patient(clinic_patient_id) ON DELETE SET NULL,
    service_type_id UUID REFERENCES service_type(id) ON DELETE SET NULL,
    service_name_raw TEXT,
    performer_text TEXT,
    status TEXT,
    result_text TEXT,
    ordered_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by_text TEXT,
    visit_link_raw TEXT,
    patient_link_raw TEXT,
    result_form_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_log_patient
    ON service_log (clinic_patient_id)
    WHERE clinic_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_log_service_type
    ON service_log (service_type_id)
    WHERE service_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_log_status
    ON service_log (status);
CREATE INDEX IF NOT EXISTS idx_service_log_started
    ON service_log (started_at DESC NULLS LAST);

COMMENT ON TABLE service_log IS 'Lần BN dùng dịch vụ cụ thể (siêu âm, thủ thuật, khám). Nhập từ Notion "Dịch vụ" — 1 dòng = 1 lần làm dịch vụ.';
COMMENT ON COLUMN service_log.source_ref IS 'Notion ID, format SERVICE-<n>.';
COMMENT ON COLUMN service_log.service_name_raw IS 'Notion "Tên dịch vụ" raw text + URL — vẫn chưa resolve sang service_type_id khi chưa match tên.';
COMMENT ON COLUMN service_log.ordered_at IS 'Notion "Giờ chỉ định" — lúc BS chỉ định dịch vụ.';
COMMENT ON COLUMN service_log.started_at IS 'Notion "//Giờ bắt đầu" — lúc thực hiện.';
COMMENT ON COLUMN service_log.finished_at IS 'Notion "//Giờ kết thúc" — xong dịch vụ.';

COMMIT;
