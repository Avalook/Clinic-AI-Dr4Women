BEGIN;

-- 1. Drop existing constraints/indexes on role and location_id
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_location_id_fkey;

-- 2. Add primary_department column and constraint
ALTER TABLE staff ADD COLUMN primary_department TEXT;

-- Map existing roles (if any) to departments
UPDATE staff SET primary_department =
  CASE
    WHEN role = 'NURSE' THEN 'NURSE_ULTRASOUND'
    WHEN role = 'RECEPTIONIST' THEN 'RECEPTION'
    WHEN role = 'TECHNICIAN' THEN 'ULTRASOUND_DOCTOR'
    WHEN role = 'MANAGER' THEN 'MANAGEMENT'
    ELSE 'DOCTOR'
  END;

-- Set primary_department to NOT NULL and add CHECK constraint
ALTER TABLE staff ALTER COLUMN primary_department SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_primary_department_check
  CHECK (primary_department IN ('DOCTOR','ULTRASOUND_DOCTOR','NURSE_ULTRASOUND','RECEPTION','CSKH','MANAGEMENT'));

-- 3. Drop role and staff_code columns
ALTER TABLE staff DROP COLUMN IF EXISTS role;
ALTER TABLE staff DROP COLUMN IF EXISTS staff_code;

-- 4. Add new columns
ALTER TABLE staff ADD COLUMN short_name TEXT;
ALTER TABLE staff ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'FULL_TIME'
  CHECK (employment_type IN ('FULL_TIME','PART_TIME','CONTRACT'));
ALTER TABLE staff ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Rename and update location_id to primary_location_id
ALTER TABLE staff RENAME COLUMN location_id TO primary_location_id;
ALTER TABLE staff ALTER COLUMN primary_location_id DROP NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_primary_location_id_fkey
  FOREIGN KEY (primary_location_id) REFERENCES clinic_location(id) ON DELETE RESTRICT;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_primary_location ON staff (primary_location_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff (is_active) WHERE is_active = TRUE;

-- 7. Add comments
COMMENT ON COLUMN staff.primary_location_id IS 'Foreign key referencing the staff member''s primary/assigned clinic location';
COMMENT ON COLUMN staff.short_name IS 'Short display/abbreviated name of the staff member';
COMMENT ON COLUMN staff.primary_department IS 'Primary department of the staff member';
COMMENT ON COLUMN staff.employment_type IS 'Employment type: FULL_TIME, PART_TIME, CONTRACT';
COMMENT ON COLUMN staff.updated_at IS 'Timestamp when the record was last updated';

-- Comment: 'StaffCapability junction deferred to Phase 9 (D-staff-capability)'
COMMENT ON TABLE staff IS 'Clinic staff members and their metadata. StaffCapability junction deferred to Phase 9 (D-staff-capability)';

COMMIT;
