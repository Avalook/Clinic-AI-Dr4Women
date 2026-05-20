BEGIN;

CREATE TABLE IF NOT EXISTS service_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    default_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE service_type IS 'Clinic service offerings and catalog (e.g., Ultrasound, Consultation)';
COMMENT ON COLUMN service_type.id IS 'Primary key of the service type';
COMMENT ON COLUMN service_type.code IS 'Unique code identifier for the service type';
COMMENT ON COLUMN service_type.name IS 'Display name of the service type';
COMMENT ON COLUMN service_type.default_duration_minutes IS 'Standard duration of this service in minutes';
COMMENT ON COLUMN service_type.is_active IS 'Flag indicating whether this service is active';
COMMENT ON COLUMN service_type.created_at IS 'Timestamp when the record was created';

COMMIT;
