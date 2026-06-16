-- Down 044: gỡ bảng giá khung service_price (+ index + policy đi kèm).
BEGIN;

DROP TABLE IF EXISTS service_price CASCADE;

COMMIT;
