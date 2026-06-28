-- Migration 062 — Seed block_budget (cấu hình vận hành thật, tracked để audit/re-run/rollback).
-- Task T-20260629-CAP-01. Chạy SAU 061. Tra ID theo TÊN/quan hệ — KHÔNG hard-code UUID (fzw≠atf).
-- Idempotent (ON CONFLICT DO NOTHING). FAIL-FAST nếu không match đúng 1 BS Thành.

BEGIN;

-- (0) FAIL-FAST: phải khớp ĐÚNG 1 BS Thành, nếu không dừng cả migration (không seed nửa vời).
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM staff
  WHERE full_name ILIKE '%Phan Chí Thành%';
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'SEED 062: khớp % nhân sự với ''Phan Chí Thành'' (cần đúng 1). Sửa điều kiện trước khi seed — KHÔNG seed mặc định suông để budget riêng của Thành không bị mất.', v_count;
  END IF;
END $$;

-- (A) Dòng MẶC ĐỊNH cấp cơ sở (doctor NULL, weekday NULL) — mọi BS/mọi ngày, giờ 8..22.
INSERT INTO block_budget
  (location_id, doctor_id, weekday, hour_start,
   thanh_budget_min, sono_budget_min, online_quota_min, walkin_quota_min,
   buffer_min, new_cap, max_total)
SELECT l.id, NULL, NULL, h,
       50, 90, 35, 10, 5, 3, 12
FROM clinic_location l
CROSS JOIN generate_series(8, 22) AS h
ON CONFLICT (location_id,
             COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
             COALESCE(weekday, 9),
             hour_start) DO NOTHING;

-- (B) Dòng RIÊNG cho BS Thành (tra theo tên) — khung tối 17..22 theo §4 Decision Doc.
WITH thanh AS (
  SELECT id FROM staff
  WHERE full_name ILIKE '%Phan Chí Thành%'
  ORDER BY full_name
  LIMIT 1
),
hrs(hour_start, thanh_budget_min, online_quota_min, walkin_quota_min,
    buffer_min, new_cap, max_total) AS (
  VALUES
    (17, 40, 28,  8, 4, 2,  8),
    (18, 50, 35, 10, 5, 2, 10),
    (19, 55, 38, 11, 6, 3, 12),
    (20, 55, 38, 11, 6, 3, 12),
    (21, 45, 32,  9, 4, 2,  9),
    (22, 30, 21,  6, 3, 1,  6)
)
INSERT INTO block_budget
  (location_id, doctor_id, weekday, hour_start,
   thanh_budget_min, sono_budget_min, online_quota_min, walkin_quota_min,
   buffer_min, new_cap, max_total)
SELECT l.id, t.id, NULL, hr.hour_start,
       hr.thanh_budget_min, 90, hr.online_quota_min, hr.walkin_quota_min,
       hr.buffer_min, hr.new_cap, hr.max_total
FROM clinic_location l
CROSS JOIN thanh t
CROSS JOIN hrs hr
ON CONFLICT (location_id,
             COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
             COALESCE(weekday, 9),
             hour_start) DO NOTHING;

COMMIT;
