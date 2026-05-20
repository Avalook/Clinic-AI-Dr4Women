BEGIN;

CREATE TABLE IF NOT EXISTS patient_medical_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID UNIQUE NOT NULL REFERENCES patient(clinic_patient_id),
    blood_type TEXT CHECK (blood_type IN ('A','B','AB','O','A+','A-','B+','B-','AB+','AB-','O+','O-')),
    allergies TEXT[] DEFAULT '{}',
    chronic_diseases TEXT[] DEFAULT '{}',
    current_medications TEXT[] DEFAULT '{}',
    surgical_history TEXT[] DEFAULT '{}',
    family_history JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE patient_medical_profile IS '1:1 medical profile per patient. General medical information.';
COMMENT ON COLUMN patient_medical_profile.id IS 'Primary key identifier';
COMMENT ON COLUMN patient_medical_profile.clinic_patient_id IS 'Unique FK to patient — enforces 1:1 relationship';
COMMENT ON COLUMN patient_medical_profile.blood_type IS 'ABO/Rh blood type classification';
COMMENT ON COLUMN patient_medical_profile.allergies IS 'Known allergies list. Phase 13 crypto-erase cho allergies/medications nếu cần';
COMMENT ON COLUMN patient_medical_profile.chronic_diseases IS 'Chronic disease history';
COMMENT ON COLUMN patient_medical_profile.current_medications IS 'Active medications list. Phase 13 crypto-erase cho allergies/medications nếu cần';
COMMENT ON COLUMN patient_medical_profile.surgical_history IS 'Past surgical procedures';
COMMENT ON COLUMN patient_medical_profile.family_history IS 'Family medical history as structured JSON';
COMMENT ON COLUMN patient_medical_profile.notes IS 'Free-text clinical notes';
COMMENT ON COLUMN patient_medical_profile.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN patient_medical_profile.updated_at IS 'Record modification timestamp';

COMMIT;
