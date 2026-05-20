BEGIN;

CREATE TABLE IF NOT EXISTS mpi_merge_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id_a UUID NOT NULL REFERENCES patient(clinic_patient_id),
    patient_id_b UUID NOT NULL REFERENCES patient(clinic_patient_id),
    score NUMERIC(5,2) NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MERGED', 'REJECTED', 'REVIEW')),
    reviewed_by UUID REFERENCES staff(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_different_patients CHECK (patient_id_a <> patient_id_b)
);

-- Composite index for performance sorting and queue routing
CREATE INDEX IF NOT EXISTS idx_mpi_merge_queue_status_score
ON mpi_merge_queue (status, score DESC);

COMMENT ON TABLE mpi_merge_queue IS 'Duplicate patient review queue managed by the Master Patient Index resolution system';
COMMENT ON COLUMN mpi_merge_queue.id IS 'Primary key identifier for the merge review request';
COMMENT ON COLUMN mpi_merge_queue.patient_id_a IS 'Foreign key referencing the first candidate patient';
COMMENT ON COLUMN mpi_merge_queue.patient_id_b IS 'Foreign key referencing the second candidate patient';
COMMENT ON COLUMN mpi_merge_queue.score IS 'Resolution match score ranging from 0.00 to 100.00';
COMMENT ON COLUMN mpi_merge_queue.status IS 'Resolution review status (PENDING, MERGED, REJECTED, REVIEW)';
COMMENT ON COLUMN mpi_merge_queue.reviewed_by IS 'Staff member who finalized the match decision';
COMMENT ON COLUMN mpi_merge_queue.reviewed_at IS 'Timestamp of the review decision';
COMMENT ON COLUMN mpi_merge_queue.created_at IS 'Timestamp of queue entry creation';

COMMIT;
