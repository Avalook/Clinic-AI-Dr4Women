BEGIN;

CREATE TABLE IF NOT EXISTS patient (
    clinic_patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_code TEXT UNIQUE NOT NULL,
    national_id_number TEXT,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    phone_primary TEXT,
    phone_secondary TEXT,
    location_id UUID NOT NULL REFERENCES clinic_location(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique constraint on national_id_number (CCCD) when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_national_id_unique
ON patient (national_id_number)
WHERE national_id_number IS NOT NULL;

-- Indexes for performance lookups
CREATE INDEX IF NOT EXISTS idx_patient_phone_primary ON patient (phone_primary);
CREATE INDEX IF NOT EXISTS idx_patient_patient_code ON patient (patient_code);

COMMENT ON TABLE patient IS 'Core patient registration and demographic identity table';
COMMENT ON COLUMN patient.clinic_patient_id IS 'Immutable primary key identifier';
COMMENT ON COLUMN patient.patient_code IS 'Human-readable UX-facing patient identifier (Format: BN-YYYY-XXXXXX)';
COMMENT ON COLUMN patient.national_id_number IS 'Vietnam citizen ID (CCCD), nullable. Note: Phase 13 crypto-erase — hiện plaintext MVP';
COMMENT ON COLUMN patient.full_name IS 'Full legal name of the patient';
COMMENT ON COLUMN patient.date_of_birth IS 'Date of birth';
COMMENT ON COLUMN patient.phone_primary IS 'Primary phone number (E.164 format)';
COMMENT ON COLUMN patient.phone_secondary IS 'Secondary/Alternative contact phone number';
COMMENT ON COLUMN patient.location_id IS 'Home clinic location foreign key reference';
COMMENT ON COLUMN patient.is_active IS 'Active status flag';
COMMENT ON COLUMN patient.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN patient.updated_at IS 'Record modification timestamp';

COMMIT;
