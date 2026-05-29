-- E2c — bảng prescription: đơn thuốc kê cho BN trong lượt khám.
-- Đóng debt CURRENT_PROGRESS §3 "prescription KHÔNG có bảng đích → file
-- PARKED (no_target_table)". transform.py đã có ``map_prescriptions``
-- output đầy đủ — chỉ thiếu target table này.
--
-- Nguồn: ``Data khách gửi/Kê thuốc/*_all.csv`` (~15.415 dòng).
-- Source ID format: "RX-<n>".

BEGIN;

CREATE TABLE IF NOT EXISTS prescription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ref TEXT UNIQUE NOT NULL,
    clinic_patient_id UUID REFERENCES patient(clinic_patient_id) ON DELETE SET NULL,
    visit_id UUID REFERENCES visit(visit_id) ON DELETE SET NULL,
    drug_name_raw TEXT,
    drug_catalog_ref TEXT,
    dosage_instructions TEXT,
    quantity TEXT,
    quantity_note TEXT,
    caution TEXT,
    standardized_form TEXT,
    visit_link_raw TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_patient
    ON prescription (clinic_patient_id)
    WHERE clinic_patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescription_visit
    ON prescription (visit_id)
    WHERE visit_id IS NOT NULL;

COMMENT ON TABLE prescription IS 'Đơn thuốc kê cho BN. 1 dòng = 1 thuốc trong 1 đơn (1 lượt khám có thể nhiều dòng).';
COMMENT ON COLUMN prescription.source_ref IS 'Notion *ID, format RX-<n>.';
COMMENT ON COLUMN prescription.drug_name_raw IS 'Notion "Tên thuốc" raw, ví dụ "[137] Gynoflor (hộp 12 viên)".';
COMMENT ON COLUMN prescription.dosage_instructions IS 'Notion "Hướng dẫn dùng", ví dụ "đặt 2v/w".';
COMMENT ON COLUMN prescription.standardized_form IS 'Notion "//chuẩn form" — đơn thuốc đã format chuẩn (nhiều dòng).';

COMMIT;
