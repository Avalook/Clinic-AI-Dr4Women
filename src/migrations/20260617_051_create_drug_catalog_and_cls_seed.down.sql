-- DOWN 051 — gỡ drug_catalog + cột CLS thêm vào service_price + rows CLS seed.
BEGIN;
DROP TABLE IF EXISTS drug_catalog;
-- xoá đúng các dòng CLS seed (service_code CLS_*), KHÔNG đụng rows nhập tay khác
DELETE FROM service_price WHERE "group" = 'dich_vu' AND service_code LIKE 'CLS\_%';
ALTER TABLE service_price DROP COLUMN IF EXISTS category;
ALTER TABLE service_price DROP COLUMN IF EXISTS tang;
COMMIT;
