-- Bảng lưu phản hồi FORM KHÁM CHUYÊN KHOA config-driven (T-EMR-FORM-ENGINE-01).
-- Engine render form theo service_code → lưu toàn bộ giá trị vào form_data JSONB.
-- Grain (khảo sát STEP 1): clinical_record 1:1 visit (UNIQUE(visit_id)), nhưng 1 visit
-- có thể có N dịch vụ → neo form theo VISIT + service_code. visit luôn tồn tại khi
-- bác sĩ khám (clinical_record có thể chưa tạo) nên FK = visit_id, KHÔNG phải record_id.
-- unique(visit_id, service_code): mỗi (buổi khám, loại dịch vụ) 1 phiếu.
-- KHÔNG ALTER clinical_record / lab_result. KHÔNG nằm nhóm append-only (043).
-- An toàn FINALIZED ép ở APP LAYER (route /api/clinical-form), không bằng trigger DB.

BEGIN;

CREATE TABLE IF NOT EXISTS clinical_form_response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visit(visit_id) ON DELETE RESTRICT,
    service_code TEXT NOT NULL,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clinical_form_visit_service UNIQUE (visit_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_clinical_form_visit
    ON clinical_form_response (visit_id);

COMMENT ON TABLE clinical_form_response IS
    'Phản hồi form khám chuyên khoa config-driven theo service_code (engine T-EMR-FORM-ENGINE-01). 1 phiếu / (visit, service_code).';
COMMENT ON COLUMN clinical_form_response.form_data IS
    'Toàn bộ giá trị form dạng JSONB { field_key: value }. Schema render do config quyết định.';

ALTER TABLE clinical_form_response ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_form_response_select_authenticated ON clinical_form_response;
CREATE POLICY clinical_form_response_select_authenticated
  ON clinical_form_response
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
