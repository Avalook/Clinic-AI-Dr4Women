BEGIN;

CREATE TABLE IF NOT EXISTS pregnancy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID NOT NULL REFERENCES patient(clinic_patient_id),
    location_id UUID NOT NULL REFERENCES clinic_location(id),
    lmp_date DATE,
    edd_date DATE,
    gestational_age_at_registration INTEGER,
    outcome TEXT DEFAULT 'ONGOING' CHECK (outcome IN ('ONGOING','DELIVERED','MISCARRIAGE','TERMINATED','UNKNOWN')),
    outcome_date DATE,
    primary_doctor_id UUID REFERENCES staff(id),
    is_high_risk BOOLEAN DEFAULT FALSE,
    high_risk_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_edd_after_lmp CHECK (
        NOT (lmp_date IS NOT NULL AND edd_date IS NOT NULL) OR edd_date > lmp_date
    )
);

-- Indexes for performance lookups
CREATE INDEX IF NOT EXISTS idx_pregnancy_clinic_patient_id ON pregnancy (clinic_patient_id);
CREATE INDEX IF NOT EXISTS idx_pregnancy_outcome ON pregnancy (outcome);
CREATE INDEX IF NOT EXISTS idx_pregnancy_primary_doctor_id ON pregnancy (primary_doctor_id);

COMMENT ON TABLE pregnancy IS 'Tracks individual pregnancies per patient. One row per pregnancy.';
COMMENT ON COLUMN pregnancy.id IS 'Primary key identifier';
COMMENT ON COLUMN pregnancy.clinic_patient_id IS 'FK to patient — a patient may have multiple pregnancies';
COMMENT ON COLUMN pregnancy.location_id IS 'Clinic location managing this pregnancy';
COMMENT ON COLUMN pregnancy.lmp_date IS 'Last Menstrual Period date';
COMMENT ON COLUMN pregnancy.edd_date IS 'Estimated Due Date — computed by application layer, NOT a DB trigger';
COMMENT ON COLUMN pregnancy.gestational_age_at_registration IS 'Gestational age in weeks at time of registration';
COMMENT ON COLUMN pregnancy.outcome IS 'Pregnancy outcome status (ONGOING, DELIVERED, MISCARRIAGE, TERMINATED, UNKNOWN)';
COMMENT ON COLUMN pregnancy.outcome_date IS 'Date of pregnancy outcome';
COMMENT ON COLUMN pregnancy.primary_doctor_id IS 'Primary attending doctor FK to staff';
COMMENT ON COLUMN pregnancy.is_high_risk IS 'High-risk pregnancy flag';
COMMENT ON COLUMN pregnancy.high_risk_reason IS 'Reason for high-risk classification';
COMMENT ON COLUMN pregnancy.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN pregnancy.updated_at IS 'Record modification timestamp';

COMMIT;
