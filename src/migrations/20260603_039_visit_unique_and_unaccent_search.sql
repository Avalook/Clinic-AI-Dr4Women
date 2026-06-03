-- 039 — Vá nhất quán dữ liệu (Đợt C audit 03/06):
--   1) Chống TRÙNG visit theo lịch hẹn (double-visit race khi ĐD + bác sĩ ghi
--      cùng lúc). Code clinical-record đã bắt 23505 → tìm lại visit.
--   2) Tìm kiếm BN BỎ DẤU ("tuyen" ra "Tuyền").
--
-- An toàn để chạy lại (IF NOT EXISTS). KHÔNG xoá/sửa data.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) UNIQUE visit theo appointment_id (partial — bỏ qua visit nhập cũ NULL).
--    ⚠️ Nếu data hiện có visit TRÙNG appointment_id, lệnh dưới sẽ LỖI. Kiểm tra:
--       SELECT appointment_id, count(*) FROM visit
--       WHERE appointment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--    Nếu có → giữ visit mới nhất, xoá/gộp bản cũ rồi chạy lại.
CREATE UNIQUE INDEX IF NOT EXISTS uq_visit_appointment_id
  ON visit (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Tìm kiếm bỏ dấu cho patient.full_name.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() là STABLE → không dùng được cho cột GENERATED/index. Bọc IMMUTABLE
-- với từ điển cố định.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $func$ SELECT unaccent('unaccent', $1) $func$;

-- Cột tên KHÔNG DẤU + thường (đ→d xử lý riêng vì unaccent không đổi đ).
ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS full_name_unaccent text
  GENERATED ALWAYS AS (
    lower(replace(replace(f_unaccent(full_name), 'đ', 'd'), 'Đ', 'D'))
  ) STORED;

-- Index trigram cho ILIKE '%...%'.
CREATE INDEX IF NOT EXISTS idx_patient_full_name_unaccent
  ON patient USING gin (full_name_unaccent gin_trgm_ops);
