-- T-DASH-ADDRESS-DROPDOWN-01 — Địa chỉ hành chính SAU sáp nhập (QĐ 19/2025/QĐ-TTg,
-- NQ 202/2025/QH15): cấu trúc TỈNH → PHƯỜNG/XÃ (BỎ cấp huyện). 34 tỉnh + 3321 ward.
-- Nguồn: github.com/ThangLeQuoc/vietnamese-provinces-database tag v3.1.0 (mới nhất,
-- đã qua bug province-code Gia Lai của v3.0.x). 2 bảng tham chiếu hành chính +
-- 5 cột địa chỉ có cấu trúc trên patient (NULLABLE — KHÔNG ghi đè patient.address
-- free-text cũ; BN cũ vẫn hiển thị được). KHÔNG đụng lâm sàng/visit/FINALIZED/043.

BEGIN;

CREATE TABLE IF NOT EXISTS province (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  code_name  TEXT
);

CREATE TABLE IF NOT EXISTS ward (
  code           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  code_name      TEXT,
  province_code  TEXT NOT NULL REFERENCES province(code)
);
CREATE INDEX IF NOT EXISTS idx_ward_province_code ON ward(province_code);

-- Địa chỉ có cấu trúc cho BN nhập MỚI. patient.address (free-text) GIỮ NGUYÊN cho
-- back-compat hiển thị; cột mới chỉ điền khi nhập qua dropdown.
ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS province_code   TEXT REFERENCES province(code),
  ADD COLUMN IF NOT EXISTS province_name   TEXT,
  ADD COLUMN IF NOT EXISTS ward_code       TEXT REFERENCES ward(code),
  ADD COLUMN IF NOT EXISTS ward_name       TEXT,
  ADD COLUMN IF NOT EXISTS address_detail  TEXT;

COMMIT;
