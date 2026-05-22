-- Migration 018: ultrasound_record (D3) + patient_summary VIEW
-- Spec: final_canon/05_DATABASE_DESIGN_FINAL.md §6 (UltrasoundRecord) and
--       §11 (PatientSummary — Q-19 TẠM CHỐT on-demand VIEW; final pending).
-- Phase: P9.7b
--
-- patient_summary is a regular VIEW (NOT materialized): all reads are real-time,
-- there is no refresh job and no cache invalidation. If query latency becomes
-- a problem we revisit Q-19 and consider a denormalized table.
-- set_updated_at() is defined in migration 015 and reused here.

CREATE TABLE IF NOT EXISTS ultrasound_record (
    ultrasound_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id               UUID NOT NULL REFERENCES visit(visit_id) ON DELETE RESTRICT,
    clinic_patient_id      UUID NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE RESTRICT,
    performed_by           UUID NULL REFERENCES staff(id) ON DELETE RESTRICT,
    pregnancy_id           UUID NULL REFERENCES pregnancy(id) ON DELETE RESTRICT,

    ultrasound_type        TEXT NULL,
    findings               JSONB NULL,
    impression             TEXT NULL,
    image_refs             TEXT[] NULL,
    gestational_age_weeks  NUMERIC NULL,
    performed_at           TIMESTAMPTZ NULL,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultrasound_visit
    ON ultrasound_record(visit_id);

CREATE INDEX IF NOT EXISTS idx_ultrasound_patient
    ON ultrasound_record(clinic_patient_id);

CREATE TRIGGER ultrasound_record_set_updated_at
    BEFORE UPDATE ON ultrasound_record
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE ultrasound_record IS
    'Ultrasound study attached to a visit. ultrasound_type is open-category TEXT (2D/4D/Doppler/...). image_refs MUST be LOCAL paths only — no cloud storage.';
COMMENT ON COLUMN ultrasound_record.findings IS
    'Free-form JSONB measurement payload (BPD/FL/AC/EFW etc.). No schema enforced — evolves with practice.';
COMMENT ON COLUMN ultrasound_record.image_refs IS
    'Array of LOCAL image paths. Cloud upload is forbidden (canon §6).';

-- patient_summary VIEW (Q-19 on-demand variant)
-- Aggregates per-patient: identity, last visit, total visits, next upcoming
-- appointment, latest lab result + triage. Real-time read, no materialization.
CREATE OR REPLACE VIEW patient_summary AS
SELECT
    p.clinic_patient_id,
    p.patient_code,
    p.full_name,
    p.date_of_birth,
    p.phone_primary,
    p.national_id_number,
    v_agg.last_visit_at,
    v_agg.total_visits,
    next_appt.next_appointment_at,
    next_appt.next_appointment_status,
    last_lab.last_lab_received_at,
    last_lab.last_lab_test_code,
    last_lab.last_lab_triage_group
FROM patient p
LEFT JOIN LATERAL (
    SELECT
        MAX(COALESCE(v.checked_in_at, v.created_at)) AS last_visit_at,
        COUNT(*)::BIGINT                              AS total_visits
    FROM visit v
    WHERE v.clinic_patient_id = p.clinic_patient_id
) v_agg ON TRUE
LEFT JOIN LATERAL (
    SELECT
        a.slot_start AS next_appointment_at,
        a.status     AS next_appointment_status
    FROM appointment a
    WHERE a.clinic_patient_id = p.clinic_patient_id
      AND a.status IN ('SCHEDULED', 'CONFIRMED')
      AND a.slot_start > NOW()
    ORDER BY a.slot_start ASC
    LIMIT 1
) next_appt ON TRUE
LEFT JOIN LATERAL (
    SELECT
        lr.result_received_at AS last_lab_received_at,
        lr.test_code          AS last_lab_test_code,
        lr.triage_group       AS last_lab_triage_group
    FROM lab_result lr
    WHERE lr.clinic_patient_id = p.clinic_patient_id
    ORDER BY lr.result_received_at DESC
    LIMIT 1
) last_lab ON TRUE;

COMMENT ON VIEW patient_summary IS
    'On-demand per-patient summary (Q-19 tentative resolution). Reads real-time across patient + visit + appointment + lab_result. Phase 9.7b.';
