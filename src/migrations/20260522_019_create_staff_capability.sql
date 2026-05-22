-- Migration 019: create staff_capability table
-- Phase: P9.6 — capability-based staff assignment
--
-- Each row pairs a staff member with a capability they can perform
-- (e.g. RECEPTION, PHLEBOTOMY, ULTRASOUND_NURSE). `capability` is TEXT
-- — no DB-level CHECK — per canon D019 (free-form values evolve).
-- Allowed values are enforced at the application layer (see
-- clinicai.schemas.staff.Capability).
--
-- FK target: staff(id). The `staff` table's primary key is `id`
-- (mig 003), same as `work_session_staff.staff_id` (mig 010).

CREATE TABLE IF NOT EXISTS staff_capability (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id          UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    capability        TEXT NOT NULL,
    proficiency_level TEXT NOT NULL DEFAULT 'COMPETENT',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_capability UNIQUE (staff_id, capability)
);

-- Allowed capability values (enforced in clinicai.schemas.staff.Capability):
--   RECEPTION | CASHIER | PHLEBOTOMY | ULTRASOUND_NURSE | CSKH | DOCTOR_CONSULTATION
-- Allowed proficiency_level values: TRAINEE | COMPETENT | EXPERT

CREATE INDEX IF NOT EXISTS idx_staff_capability_staff_id
    ON staff_capability(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_capability_capability
    ON staff_capability(capability);

COMMENT ON TABLE staff_capability IS
    'Capabilities a staff member can perform. Junction-like, app-enforced enum (D019).';
COMMENT ON COLUMN staff_capability.capability IS
    'Free-form TEXT; app layer enforces allowed values via Capability schema.';
COMMENT ON COLUMN staff_capability.proficiency_level IS
    'TRAINEE / COMPETENT / EXPERT — informational, no scheduling logic depends on it yet.';
