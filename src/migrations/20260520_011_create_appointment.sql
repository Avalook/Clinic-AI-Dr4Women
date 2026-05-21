BEGIN;

CREATE TABLE IF NOT EXISTS appointment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id UUID NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE RESTRICT,
    doctor_id UUID NULL REFERENCES staff(id),
    work_session_id UUID NULL REFERENCES work_session(id),
    location_id UUID NOT NULL REFERENCES clinic_location(id),
    service_type_id UUID NOT NULL REFERENCES service_type(id),
    booking_channel TEXT,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    assigned_station TEXT,
    queue_number TEXT,
    is_priority_slot BOOLEAN NOT NULL DEFAULT FALSE,
    is_walkin BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED')),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (slot_end > slot_start)
);

CREATE INDEX IF NOT EXISTS idx_appointment_patient ON appointment (clinic_patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_date ON appointment (doctor_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_appointment_session ON appointment (work_session_id);
CREATE INDEX IF NOT EXISTS idx_appointment_status ON appointment (status) WHERE status IN ('SCHEDULED','CONFIRMED','CHECKED_IN');

COMMENT ON TABLE appointment IS 'Patient appointments for services scheduled with doctors or work sessions';

COMMIT;
