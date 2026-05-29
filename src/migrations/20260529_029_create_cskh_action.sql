-- E2c — bảng CSKH Action: log mọi tương tác CSKH với BN.
-- Onboard-phase1.md ghi rõ "Nhóm Action bao gồm: Đặt lịch khám, Tư vấn
-- sau khám, Trả KQ XN, Xử lý thắc mắc, Nhắc tái khám, CSKH thường quy".
--
-- Nguồn data: ``Data khách gửi/CSKH Action/*_all.csv`` (~31.179 dòng).
-- Source ID format: "ACT-<n>".
--
-- Quan hệ:
--   - clinic_patient_id: resolve qua extract_phone từ
--     "🔑 File khách hàng (hành chính)" link text (SET NULL nếu không
--     extract được — vẫn giữ row để audit).
--   - appointment/visit/lab: PARKED ở dạng *_link_raw cột TEXT (link
--     text gốc); resolve sang FK Phase 2 khi có URL→UUID lookup map.

BEGIN;

CREATE TABLE IF NOT EXISTS cskh_action (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ref TEXT UNIQUE NOT NULL,
    clinic_patient_id UUID REFERENCES patient(clinic_patient_id) ON DELETE SET NULL,
    category TEXT,
    step TEXT,
    status TEXT,
    action_data TEXT,
    description TEXT,
    result_text TEXT,
    deadline_at TIMESTAMPTZ,
    source_created_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    created_by_text TEXT,
    last_edited_by_text TEXT,
    rating INTEGER,
    billing_tag TEXT,
    appointment_link_raw TEXT,
    visit_link_raw TEXT,
    lab_link_raw TEXT,
    patient_link_raw TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cskh_action_patient
    ON cskh_action (clinic_patient_id)
    WHERE clinic_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cskh_action_category
    ON cskh_action (category);
CREATE INDEX IF NOT EXISTS idx_cskh_action_deadline
    ON cskh_action (deadline_at)
    WHERE deadline_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cskh_action_source_created
    ON cskh_action (source_created_at DESC NULLS LAST);

COMMENT ON TABLE cskh_action IS 'CSKH activity log nhập từ Notion "CSKH - Action" (~31k dòng). 1 dòng = 1 lần CSKH thao tác (đặt lịch, nhắc, tư vấn, ...).';
COMMENT ON COLUMN cskh_action.source_ref IS 'Notion //ID, format ACT-<n>. UNIQUE để re-sync idempotent.';
COMMENT ON COLUMN cskh_action.category IS 'Notion "Phân loại": Đặt hẹn / Tư vấn / Nhắc tái khám / ...';
COMMENT ON COLUMN cskh_action.step IS 'Notion "Step": #request / #report.';
COMMENT ON COLUMN cskh_action.status IS 'Notion "Tình trạng": "Kết thúc / Đã xác nhận lịch hẹn / Đã nhắc" — raw multi-token text.';
COMMENT ON COLUMN cskh_action.action_data IS 'Notion "Dữ liệu thao tác" — nội dung CSKH gõ.';
COMMENT ON COLUMN cskh_action.rating IS 'Notion "Điểm đánh giá" (-2 → +2).';
COMMENT ON COLUMN cskh_action.appointment_link_raw IS 'Notion "//file lịch hẹn" — text "Name SDT (URL)"; resolve sang FK appointment.id ở Phase 2.';

COMMIT;
