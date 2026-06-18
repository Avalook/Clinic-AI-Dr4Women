-- DOWN T-DASH-CSKH-VANDE-LINHVUC-01. Gỡ constraint + 2 cột. Idempotent.

BEGIN;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_linh_vuc_check;
ALTER TABLE patient DROP COLUMN IF EXISTS van_de_di_kham;
ALTER TABLE patient DROP COLUMN IF EXISTS linh_vuc;

COMMIT;
