-- Migration 016: create staff_task table
-- Phase: P9.3 Task Manager sub-graph
--
-- Cross-cutting work queue for clinic staff. Sources include lab_triage
-- (LAB_REVIEW for GROUP_C results), scheduling (SLOT_FILL), intake
-- (INTAKE_FOLLOWUP), etc. `source_type` + `source_id` form a polymorphic
-- pointer back to the originating entity (no FK; cross-table polymorphism
-- is intentional and resolved at the application layer).
--
-- `location_id` replaces an earlier `clinic_id` proposal: the codebase has
-- no `clinic` table — `clinic_location` is the smallest tenancy unit.

CREATE TABLE IF NOT EXISTS staff_task (
    task_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id    UUID REFERENCES clinic_location(id) ON DELETE RESTRICT,

    task_type      TEXT NOT NULL,
    priority       TEXT NOT NULL DEFAULT 'NORMAL'
                   CHECK (priority IN ('URGENT', 'HIGH', 'NORMAL')),
    status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED')),

    assigned_to    UUID REFERENCES staff(id) ON DELETE SET NULL,

    source_type    TEXT,
    source_id      UUID,

    title          TEXT NOT NULL,
    description    TEXT,

    due_at         TIMESTAMPTZ,
    sla_hours      INTEGER NOT NULL DEFAULT 24 CHECK (sla_hours > 0),
    completed_at   TIMESTAMPTZ,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT staff_task_done_requires_completed_at
        CHECK (
            (status <> 'DONE') OR (completed_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_staff_task_assigned
    ON staff_task(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_staff_task_source
    ON staff_task(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_staff_task_due
    ON staff_task(due_at)
    WHERE status = 'PENDING';

CREATE TRIGGER staff_task_set_updated_at
    BEFORE UPDATE ON staff_task
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE staff_task IS
    'Cross-cutting work queue for clinic staff. Phase 9.3 Task Manager.';
COMMENT ON COLUMN staff_task.task_type IS
    'Free-form category (e.g. LAB_REVIEW, SLOT_FILL, PATIENT_CALLBACK). No CHECK — kinds evolve.';
COMMENT ON COLUMN staff_task.source_type IS
    'Polymorphic source label (e.g. LAB_RESULT, APPOINTMENT). Application-enforced.';
COMMENT ON COLUMN staff_task.source_id IS
    'UUID of the source entity. Pair with source_type for back-reference.';
COMMENT ON COLUMN staff_task.sla_hours IS
    'Service-level target in hours from created_at. 24 default, 4 for GROUP_C lab review.';
