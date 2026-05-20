BEGIN;

INSERT INTO clinic_location (code, name, address, is_active)
VALUES
  ('KN', 'Kim Ngưu', '99 Kim Ngưu, Hai Bà Trưng, Hà Nội', TRUE),
  ('HN', 'Hào Nam', '12 Hào Nam, Đống Đa, Hà Nội', FALSE)
ON CONFLICT (code) DO NOTHING;

COMMIT;
