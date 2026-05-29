-- Seed 7 kênh đặt lịch mặc định theo Onboard-phase1.md Nhóm 1.
-- Re-runnable: ON CONFLICT (code) DO NOTHING.
-- code đặt theo NGỮ NGHĨA (đọc ra biết kênh nào — không lookup), giữ
-- nguyên cho mọi cơ sở.

BEGIN;

INSERT INTO booking_channel (code, name, category) VALUES
  ('ZALO_PK',      'Zalo OA Phòng khám',           'ZALO'),
  ('FB_DR4WOMEN',  'FB Dr4women (BS Thành)',       'FACEBOOK'),
  ('FB_4WOMEN',    'FB 4women Clinic',             'FACEBOOK'),
  ('FB_ACADEMY',   'FB Academy',                   'FACEBOOK'),
  ('HOTLINE',      'Hotline',                      'HOTLINE'),
  ('WALK_IN',      'Khách walk-in',                'WALK_IN'),
  ('REFERRAL',     'Giới thiệu (BN cũ / đồng nghiệp)', 'REFERRAL')
ON CONFLICT (code) DO NOTHING;

COMMIT;
