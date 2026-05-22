-- Migration 017: D3 Clinical Domain — visit + clinical_record + visit_amendment
-- Spec: final_canon/05_DATABASE_DESIGN_FINAL.md §5-6
-- Phase: P9.7a Clinical Domain
--
-- Medical safety gates (TT13/2011/TT-BYT):
--   1. FINALIZED visits cannot be updated, except a single transition
--      FINALIZED → AMENDED when a valid VisitAmendment is recorded.
--   2. visit_amendment is APPEND-ONLY (UPDATE / DELETE blocked at DB level).
--
-- The set_updated_at() function is created in migration 015 and reused here.

CREATE TABLE IF NOT EXISTS visit (
    visit_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_patient_id     UUID NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE RESTRICT,
    appointment_id        UUID NULL REFERENCES appointment(id) ON DELETE RESTRICT,
    work_session_id       UUID NULL REFERENCES work_session(id) ON DELETE RESTRICT,
    attending_doctor_id   UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
    location_id           UUID NULL REFERENCES clinic_location(id) ON DELETE RESTRICT,
    service_type_id       UUID NULL REFERENCES service_type(id) ON DELETE RESTRICT,

    status                TEXT NOT NULL DEFAULT 'OPEN'
                          CHECK (status IN ('OPEN','IN_PROGRESS','FINALIZED','AMENDED')),

    finalized_at          TIMESTAMPTZ NULL,
    finalized_by          UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
    checked_in_at         TIMESTAMPTZ NULL,
    checked_in_by         UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_patient ON visit(clinic_patient_id);

CREATE TABLE IF NOT EXISTS clinical_record (
    record_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id                  UUID NOT NULL UNIQUE REFERENCES visit(visit_id) ON DELETE RESTRICT,
    pregnancy_id              UUID NULL REFERENCES pregnancy(id) ON DELETE RESTRICT,

    soap_subjective           JSONB NULL,
    soap_objective            JSONB NULL,
    soap_assessment           JSONB NULL,
    soap_plan                 JSONB NULL,
    chief_complaint_at_visit  TEXT NULL,

    voice_note_url            TEXT NULL,
    voice_transcript          TEXT NULL,
    voice_note_reviewed       BOOLEAN NOT NULL DEFAULT FALSE,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visit_amendment (
    amendment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id           UUID NOT NULL REFERENCES visit(visit_id) ON DELETE RESTRICT,
    amended_by         UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    amended_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason             TEXT NOT NULL,
    corrected_fields   TEXT[] NOT NULL,
    original_values    JSONB NOT NULL,
    corrected_values   JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visit_amendment_visit ON visit_amendment(visit_id);

-- Trigger 1: BEFORE UPDATE on visit — block edits once FINALIZED.
-- Only allowed transition is FINALIZED → AMENDED (when a valid VisitAmendment
-- has been recorded by application code).
CREATE OR REPLACE FUNCTION visit_finalized_block_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'FINALIZED' AND NEW.status <> 'AMENDED' THEN
        RAISE EXCEPTION
            'visit % is FINALIZED; UPDATE blocked except FINALIZED -> AMENDED (TT13/2011/TT-BYT)',
            OLD.visit_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_finalized_block
    BEFORE UPDATE ON visit
    FOR EACH ROW
    EXECUTE FUNCTION visit_finalized_block_update();

-- Trigger 2: APPEND-ONLY enforcement on visit_amendment.
-- Any UPDATE or DELETE is rejected by the DB.
CREATE OR REPLACE FUNCTION visit_amendment_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'visit_amendment is append-only; UPDATE/DELETE not permitted (TT13/2011/TT-BYT)'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_amendment_no_update
    BEFORE UPDATE ON visit_amendment
    FOR EACH ROW
    EXECUTE FUNCTION visit_amendment_append_only();

CREATE TRIGGER trg_visit_amendment_no_delete
    BEFORE DELETE ON visit_amendment
    FOR EACH ROW
    EXECUTE FUNCTION visit_amendment_append_only();

CREATE TRIGGER visit_set_updated_at
    BEFORE UPDATE ON visit
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER clinical_record_set_updated_at
    BEFORE UPDATE ON clinical_record
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE visit IS
    'Actual patient encounter (D3 Clinical). Status machine OPEN -> IN_PROGRESS -> FINALIZED -> AMENDED. FINALIZED is DB-enforced immutable (TT13/2011/TT-BYT).';
COMMENT ON TABLE clinical_record IS
    'SOAP clinical record, 1:1 with visit. Spec: final_canon/05 §6.';
COMMENT ON TABLE visit_amendment IS
    'APPEND-ONLY amendments to FINALIZED visits. Append-only enforced by trg_visit_amendment_no_update / trg_visit_amendment_no_delete (TT13/2011/TT-BYT).';
COMMENT ON COLUMN visit.status IS
    'OPEN -> IN_PROGRESS -> FINALIZED -> AMENDED. FINALIZED locked via trigger.';
COMMENT ON COLUMN clinical_record.voice_note_url IS
    'LOCAL storage path only — voice notes MUST NOT be uploaded to cloud.';
