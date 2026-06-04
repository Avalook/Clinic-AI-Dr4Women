-- Migration 040: cột `patient.birth_year` cho feedback dashboard (Thu Lê 04/06).
-- Nhiều BN chỉ nhớ NĂM sinh (không nhớ ngày/tháng) — feedback B5#4 "tự động năm".
-- Khi chỉ có năm: lưu `birth_year`, để `date_of_birth` NULL. Hiển thị ưu tiên
-- date_of_birth, fallback birth_year. NULLABLE + additive + re-runnable
-- (ADD COLUMN IF NOT EXISTS) → KHÔNG phá dữ liệu sẵn có.
--
-- Code dashboard chạy được CẢ KHI chưa apply migration này (POST /api/patients
-- bắt lỗi 42703 → fallback lưu date_of_birth = `${năm}-01-01`). Apply migration
-- để lưu năm CHÍNH XÁC + hiển thị đúng "chỉ năm".

BEGIN;

ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT;

ALTER TABLE patient DROP CONSTRAINT IF EXISTS patient_birth_year_check;
ALTER TABLE patient ADD CONSTRAINT patient_birth_year_check
  CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100));

COMMENT ON COLUMN patient.birth_year IS
  'Năm sinh khi BN không nhớ ngày/tháng (feedback B5#4). date_of_birth NULL khi chỉ có năm.';

COMMIT;
