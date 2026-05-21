BEGIN;

CREATE TABLE IF NOT EXISTS work_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES clinic_location(id),
    session_date DATE NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('EVENING','WEEKEND_MORNING','WEEKEND_AFTERNOON')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (location_id, session_date, session_type),
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_work_session_date ON work_session (session_date DESC);

COMMENT ON TABLE work_session IS 'Work sessions/shifts scheduled for a clinic location';

COMMIT;
