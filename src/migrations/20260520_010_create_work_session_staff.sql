BEGIN;

CREATE TABLE IF NOT EXISTS work_session_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_session_id UUID NOT NULL REFERENCES work_session(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    role TEXT NOT NULL,
    station TEXT NOT NULL,
    on_call_flag BOOLEAN NOT NULL DEFAULT FALSE,
    is_training BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (work_session_id, staff_id, station)
);

CREATE INDEX IF NOT EXISTS idx_wss_work_session ON work_session_staff (work_session_id);
CREATE INDEX IF NOT EXISTS idx_wss_staff ON work_session_staff (staff_id);

COMMENT ON COLUMN work_session_staff.station IS 'Free text TEXT instead of ENUM — Q-28 station list still evolving';
COMMENT ON TABLE work_session_staff IS 'Junction table linking staff members to work sessions and stations';

COMMIT;
