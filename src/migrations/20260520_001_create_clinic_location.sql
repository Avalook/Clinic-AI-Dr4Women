BEGIN;

CREATE TABLE IF NOT EXISTS clinic_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE clinic_location IS 'Physical locations/branches of the clinic (e.g., Kim Nguu, Hao Nam)';
COMMENT ON COLUMN clinic_location.id IS 'Primary key of the clinic location';
COMMENT ON COLUMN clinic_location.code IS 'Unique code identifier for the clinic location (e.g., KN, HN)';
COMMENT ON COLUMN clinic_location.name IS 'Display name of the location';
COMMENT ON COLUMN clinic_location.address IS 'Physical address of the location';
COMMENT ON COLUMN clinic_location.is_active IS 'Flag indicating whether this location is active';
COMMENT ON COLUMN clinic_location.created_at IS 'Timestamp when the record was created';

COMMIT;
