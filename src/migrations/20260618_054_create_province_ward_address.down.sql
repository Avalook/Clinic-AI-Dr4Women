-- DOWN T-DASH-ADDRESS-DROPDOWN-01. Gỡ 5 cột địa chỉ cấu trúc trên patient TRƯỚC
-- (vì FK tới province/ward), rồi drop ward → province. patient.address free-text
-- KHÔNG đụng. Idempotent (IF EXISTS).

BEGIN;

ALTER TABLE patient
  DROP COLUMN IF EXISTS province_code,
  DROP COLUMN IF EXISTS province_name,
  DROP COLUMN IF EXISTS ward_code,
  DROP COLUMN IF EXISTS ward_name,
  DROP COLUMN IF EXISTS address_detail;

DROP TABLE IF EXISTS ward;
DROP TABLE IF EXISTS province;

COMMIT;
