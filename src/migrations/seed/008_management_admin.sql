-- Bootstrap ONE MANAGEMENT staff row so the in-app account-management UI
-- (/settings + /settings/new-user, gated by primary_department='MANAGEMENT')
-- becomes reachable. The Notion staff seed (005) produces 0 MANAGEMENT
-- rows, so without this nobody can pass the admin gate and the whole
-- F3 self-service account flow is locked.
--
-- BOOTSTRAP (one-time, operator/console — cannot be done in-app yet):
--   1. Apply this seed.
--   2. Supabase console → Authentication → Users → Add user (your admin
--      email + password, tick Auto-confirm). Copy the UUID.
--   3. poetry run python scripts/seed/link_staff_to_auth.py \
--        --map "Quản trị hệ thống=<uuid>"
--   4. Log in → /settings is now reachable; create every other account
--      from there (no console needed again).
--
-- Alternative: instead of this generic row, promote an existing person:
--   UPDATE staff SET primary_department='MANAGEMENT' WHERE full_name='...';
--
-- Re-runnable: guarded by IF NOT EXISTS on full_name.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Quản trị hệ thống') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Quản trị hệ thống', 'Admin', 'MANAGEMENT', NULL, 'FULL_TIME', FALSE, TRUE);
  END IF;
END $$;

COMMIT;
