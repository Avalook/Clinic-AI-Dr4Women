BEGIN;

-- Revert staff table back to 003 structure

-- 1. Drop indexes and constraints
DROP INDEX IF EXISTS idx_staff_primary_location;
DROP INDEX IF EXISTS idx_staff_active;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_primary_department_check;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_primary_location_id_fkey;

-- 2. Rename primary_location_id back to location_id
ALTER TABLE staff RENAME COLUMN primary_location_id TO location_id;

-- Assign default location if null, to enforce NOT NULL
DO $$
DECLARE
    default_loc_id UUID;
BEGIN
    SELECT id INTO default_loc_id FROM clinic_location LIMIT 1;
    IF default_loc_id IS NOT NULL THEN
        UPDATE staff SET location_id = default_loc_id WHERE location_id IS NULL;
    END IF;
END $$;

ALTER TABLE staff ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_location_id_fkey FOREIGN KEY (location_id) REFERENCES clinic_location(id);

-- 3. Drop columns
ALTER TABLE staff DROP COLUMN IF EXISTS short_name;
ALTER TABLE staff DROP COLUMN IF EXISTS primary_department;
ALTER TABLE staff DROP COLUMN IF EXISTS employment_type;
ALTER TABLE staff DROP COLUMN IF EXISTS updated_at;

-- 4. Re-add role and staff_code
ALTER TABLE staff ADD COLUMN role TEXT;
UPDATE staff SET role = 'DOCTOR';
ALTER TABLE staff ALTER COLUMN role SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('DOCTOR', 'NURSE', 'RECEPTIONIST', 'TECHNICIAN', 'MANAGER'));

ALTER TABLE staff ADD COLUMN staff_code TEXT;
UPDATE staff SET staff_code = 'ST-' || id::text;
ALTER TABLE staff ALTER COLUMN staff_code SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_staff_code_key UNIQUE (staff_code);

-- Restore table comment
COMMENT ON TABLE staff IS 'Clinic staff members and their metadata';

COMMIT;
