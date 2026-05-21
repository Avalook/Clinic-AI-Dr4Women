-- Migration: Create event_log table with append-only triggers
-- Target: Supabase / PostgreSQL database

CREATE TABLE event_log (
    -- Identity
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event metadata
    event_type          TEXT NOT NULL,
        -- VD: 'appointment.created', 'patient.merged', 'lab.ordered'
        -- Format: '<aggregate>.<verb>' (dot-separated, lowercase, snake_case)
    event_version       INTEGER NOT NULL DEFAULT 1,
        -- Schema version của payload, tăng khi đổi structure
    aggregate_type      TEXT NOT NULL,
        -- VD: 'appointment', 'patient', 'lab_order'
    aggregate_id        UUID NOT NULL,
        -- ID của entity bị tác động (vd: appointment.id, patient.clinic_patient_id)

    -- Payload
    payload             JSONB NOT NULL,
        -- Snapshot dữ liệu thay đổi, đủ để replay state
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
        -- Context: user_id, ip, trace_id, source_adapter, etc.

    -- Causality tracking (cho P5+ event chaining)
    correlation_id      UUID,
        -- ID nhóm các events thuộc cùng 1 business transaction
    causation_id        UUID REFERENCES event_log(event_id),
        -- ID của event đã trigger event này (parent-child)

    -- Source tracking
    source              TEXT NOT NULL,
        -- VD: 'api', 'worker', 'adapter:pancake', 'adapter:zalo', 'system'

    -- Timestamps
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- Thời điểm event xảy ra (business time)
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- Thời điểm event được ghi vào DB (system time)

    -- Constraints
    CONSTRAINT event_type_format CHECK (
        event_type ~ '^[a-z_]+\.[a-z_]+$'
    ),
    CONSTRAINT event_version_positive CHECK (event_version > 0),
    CONSTRAINT source_not_empty CHECK (length(source) > 0)
);

-- Indexes (tối thiểu, thêm sau khi có query pattern thực tế)
CREATE INDEX idx_event_log_aggregate ON event_log (aggregate_type, aggregate_id, occurred_at);
CREATE INDEX idx_event_log_event_type ON event_log (event_type, occurred_at);
CREATE INDEX idx_event_log_correlation ON event_log (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_event_log_occurred_at ON event_log (occurred_at);

-- Comment
COMMENT ON TABLE event_log IS
'Append-only event sourcing log. Single source of truth for all state changes.
NEVER UPDATE. NEVER DELETE. NEVER TRUNCATE. Enforced by trigger enforce_append_only().';

-- Function
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'event_log is append-only: UPDATE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'event_log is append-only: DELETE not allowed (event_id: %)', OLD.event_id
            USING ERRCODE = 'insufficient_privilege';
    ELSIF TG_OP = 'TRUNCATE' THEN
        RAISE EXCEPTION 'event_log is append-only: TRUNCATE not allowed'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_event_log_no_update
    BEFORE UPDATE ON event_log
    FOR EACH ROW
    EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER trg_event_log_no_delete
    BEFORE DELETE ON event_log
    FOR EACH ROW
    EXECUTE FUNCTION enforce_append_only();

CREATE TRIGGER trg_event_log_no_truncate
    BEFORE TRUNCATE ON event_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION enforce_append_only();

COMMENT ON FUNCTION enforce_append_only() IS
'Enforce append-only invariant on event_log. Used by 3 triggers.
Raises insufficient_privilege error on UPDATE/DELETE/TRUNCATE.';
