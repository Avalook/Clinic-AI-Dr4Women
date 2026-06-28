-- Down 062 — gỡ các dòng seed (chỉ đúng tổ hợp do 062 tạo, không đụng dòng cấu hình thủ công khác).
BEGIN;

-- (A) dòng mặc định cấp cơ sở giờ 8..22
DELETE FROM block_budget
WHERE doctor_id IS NULL
  AND weekday IS NULL
  AND hour_start BETWEEN 8 AND 22;

-- (B) dòng riêng BS Thành khung 17..22
DELETE FROM block_budget
WHERE weekday IS NULL
  AND hour_start BETWEEN 17 AND 22
  AND doctor_id IN (
    SELECT id FROM staff WHERE full_name ILIKE '%Phan Chí Thành%'
  );

COMMIT;
