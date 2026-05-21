-- Migration 015: create lab_result table
-- Spec: docs/lab_triage_spec_v1.md
-- Phase: P9.2 Lab Triage sub-graph

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS lab_result (
    lab_result_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id    UUID NOT NULL REFERENCES patient(clinic_patient_id),
    visit_id             UUID,
    appointment_id       UUID REFERENCES appointment(id),

    test_code            TEXT NOT NULL,
    test_name            TEXT NOT NULL,
    panel_code           TEXT,

    result_value         TEXT,
    result_numeric       NUMERIC,
    result_unit          TEXT,
    reference_range_low  NUMERIC,
    reference_range_high NUMERIC,
    flag                 TEXT CHECK (flag IN ('NORMAL','HIGH','LOW','CRITICAL_HIGH','CRITICAL_LOW','ABNORMAL')),

    triage_group         TEXT NOT NULL DEFAULT 'PENDING'
                         CHECK (triage_group IN ('GROUP_A','GROUP_B','GROUP_C','PENDING')),
    triage_reason        TEXT,
    triage_classified_at TIMESTAMPTZ,
    triage_model         TEXT,

    requires_doctor_review BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by_staff_id   UUID REFERENCES staff(id),
    reviewed_at            TIMESTAMPTZ,
    is_finalized           BOOLEAN NOT NULL DEFAULT FALSE,

    lab_provider         TEXT,
    external_ref         TEXT,
    raw_payload          JSONB,

    sample_collected_at  TIMESTAMPTZ,
    result_received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lab_result_finalized_requires_reviewer
        CHECK (
            (is_finalized = FALSE)
            OR (is_finalized = TRUE AND reviewed_by_staff_id IS NOT NULL AND reviewed_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_lab_result_patient
    ON lab_result(clinic_patient_id, result_received_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_result_triage_pending
    ON lab_result(triage_group)
    WHERE triage_group = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_lab_result_safety_gate
    ON lab_result(requires_doctor_review, is_finalized)
    WHERE requires_doctor_review = TRUE AND is_finalized = FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_result_appointment
    ON lab_result(appointment_id)
    WHERE appointment_id IS NOT NULL;

CREATE TRIGGER lab_result_set_updated_at
    BEFORE UPDATE ON lab_result
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE lab_result IS 'Lab results with triage classification. Spec: docs/lab_triage_spec_v1.md. Phase 9.2.';
COMMENT ON COLUMN lab_result.triage_group IS 'GROUP_A=normal, GROUP_B=borderline BS review, GROUP_C=critical HARD BLOCK';
COMMENT ON COLUMN lab_result.requires_doctor_review IS 'HARD BLOCK gate: TRUE blocks BN-facing AI until is_finalized=TRUE';
