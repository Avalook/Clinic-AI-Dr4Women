BEGIN;

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES clinic_location(id),
    staff_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('DOCTOR', 'NURSE', 'RECEPTIONIST', 'TECHNICIAN', 'MANAGER')),
    is_active BOOLEAN DEFAULT TRUE,
    is_training BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE staff IS 'Clinic staff members and their metadata';
COMMENT ON COLUMN staff.id IS 'Primary key of the staff member';
COMMENT ON COLUMN staff.location_id IS 'Foreign key referencing the staff member''s primary/assigned clinic location';
COMMENT ON COLUMN staff.staff_code IS 'Unique code identifier for the staff member';
COMMENT ON COLUMN staff.full_name IS 'Full legal name of the staff member';
COMMENT ON COLUMN staff.role IS 'Primary role of the staff member (DOCTOR, NURSE, RECEPTIONIST, TECHNICIAN, MANAGER)';
COMMENT ON COLUMN staff.is_active IS 'Flag indicating whether this staff member is active';
COMMENT ON COLUMN staff.is_training IS 'Flag indicating whether this staff member is currently a trainee';
COMMENT ON COLUMN staff.created_at IS 'Timestamp when the record was created';

COMMIT;
