DO $$
DECLARE
  kn_id UUID;
BEGIN
  SELECT id INTO kn_id FROM clinic_location WHERE code = 'KN';

  -- DOCTORS (primary_department='DOCTOR')
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Thành') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Thành', 'Thành', 'DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Hằng') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Hằng', 'Hằng', 'DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Nam') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Nam', 'Nam', 'DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Hùng') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Hùng', 'Hùng', 'DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Thiệp') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Thiệp', 'Thiệp', 'DOCTOR', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Đào') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Đào', 'Đào', 'DOCTOR', kn_id, 'PART_TIME', FALSE, FALSE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Linh Nam khoa') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Linh Nam khoa', 'Linh', 'DOCTOR', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS Quyết') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS Quyết', 'Quyết', 'DOCTOR', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  -- ULTRASOUND DOCTORS (primary_department='ULTRASOUND_DOCTOR')
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS SA Minh') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS SA Minh', 'SA Minh', 'ULTRASOUND_DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS SA Hoàng') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS SA Hoàng', 'SA Hoàng', 'ULTRASOUND_DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS SA Tiến') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS SA Tiến', 'SA Tiến', 'ULTRASOUND_DOCTOR', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS SA Giáp') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS SA Giáp', 'SA Giáp', 'ULTRASOUND_DOCTOR', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'BS SA Đạt') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'BS SA Đạt', 'SA Đạt', 'ULTRASOUND_DOCTOR', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  -- NURSE/KTV ULTRASOUND (primary_department='NURSE_ULTRASOUND')
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Trang Lê') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Trang Lê', 'Trang Lê', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Thanh Hải') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Thanh Hải', 'Thanh Hải', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Giầu') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Giầu', 'Giầu', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Dương Trang') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Dương Trang', 'Dương Trang', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Hà Vũ') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Hà Vũ', 'Hà Vũ', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Hương Linh') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Hương Linh', 'Hương Linh', 'NURSE_ULTRASOUND', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'ĐD Hằng') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'ĐD Hằng', 'Hằng ĐD', 'NURSE_ULTRASOUND', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'TL Vân Anh') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'TL Vân Anh', 'Vân Anh', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'TL Duy Nam') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'TL Duy Nam', 'Duy Nam', 'NURSE_ULTRASOUND', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  -- CSKH (primary_department='CSKH')
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thanh Tươi Nguyễn') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thanh Tươi Nguyễn', 'Thanh Tươi', 'CSKH', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Trang Lê (CSKH)') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Trang Lê (CSKH)', 'Trang CSKH', 'CSKH', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thu Hà Vũ') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thu Hà Vũ', 'Thu Hà', 'CSKH', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Nguyệt Trần') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Nguyệt Trần', 'Nguyệt', 'CSKH', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Diệu Huyền') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Diệu Huyền', 'Diệu Huyền', 'CSKH', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Thủy Kiều') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Thủy Kiều', 'Thủy Kiều', 'CSKH', kn_id, 'PART_TIME', FALSE, TRUE);
  END IF;

  -- RECEPTION (primary_department='RECEPTION')
  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = 'Lễ Tân 1') THEN
    INSERT INTO staff (id, full_name, short_name, primary_department, primary_location_id, employment_type, is_training, is_active)
    VALUES (gen_random_uuid(), 'Lễ Tân 1', 'Lễ Tân 1', 'RECEPTION', kn_id, 'FULL_TIME', FALSE, TRUE);
  END IF;

END $$;
