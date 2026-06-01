-- Migration 032: grant authenticated SELECT on reference/clinical tables that
-- had RLS ENABLED but NO policy → every PostgREST read (anon AND authenticated)
-- silently returned 0 rows. This broke the dashboard's doctor picker, service
-- and location dropdowns, doctor-name joins, and the pregnancy history section.
--
-- Mirrors the existing pattern (patient/visit/clinical_record/lab_result/
-- appointment all have a *_select_authenticated policy). Grants read ONLY to
-- the `authenticated` role, so the shared clinic session can read them while
-- anon (the open internet, no login) still cannot.
--
-- Re-runnable: DROP POLICY IF EXISTS before each CREATE.

-- staff (clinic employees — doctor picker, name joins, settings)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;  -- idempotent
DROP POLICY IF EXISTS staff_select_authenticated ON staff;
CREATE POLICY staff_select_authenticated
  ON staff FOR SELECT TO authenticated USING (true);

-- service_type (service catalogue — appointment service names, intake dropdown)
ALTER TABLE service_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_type_select_authenticated ON service_type;
CREATE POLICY service_type_select_authenticated
  ON service_type FOR SELECT TO authenticated USING (true);

-- clinic_location (2 clinics — intake/appointment location dropdown)
ALTER TABLE clinic_location ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clinic_location_select_authenticated ON clinic_location;
CREATE POLICY clinic_location_select_authenticated
  ON clinic_location FOR SELECT TO authenticated USING (true);

-- pregnancy (doctor patient-history section)
ALTER TABLE pregnancy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pregnancy_select_authenticated ON pregnancy;
CREATE POLICY pregnancy_select_authenticated
  ON pregnancy FOR SELECT TO authenticated USING (true);
