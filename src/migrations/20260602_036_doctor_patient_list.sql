-- Bác sĩ chỉ xem được bệnh nhân CỦA MÌNH (BN từng có lịch hẹn với bác sĩ đó).
-- Lọc + tìm + phân trang phía DB (BN của 1 bác sĩ có thể tới ~800 → không thể
-- lọc bằng danh sách id trên URL). SECURITY INVOKER → RLS bảng patient vẫn áp.
-- KHÔNG trả national_id_number (D-identity).

BEGIN;

CREATE OR REPLACE FUNCTION doctor_patient_list(
  p_doctor_id UUID,
  p_term TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  clinic_patient_id UUID,
  patient_code TEXT,
  full_name TEXT,
  date_of_birth DATE,
  phone_primary TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH mine AS (
    SELECT DISTINCT a.clinic_patient_id AS pid
    FROM appointment a
    WHERE a.doctor_id = p_doctor_id
  ),
  filtered AS (
    SELECT p.clinic_patient_id, p.patient_code, p.full_name,
           p.date_of_birth, p.phone_primary, p.created_at
    FROM patient p
    JOIN mine ON mine.pid = p.clinic_patient_id
    WHERE COALESCE(p_term, '') = ''
       OR p.patient_code ILIKE '%' || p_term || '%'
       OR p.full_name   ILIKE '%' || p_term || '%'
       OR p.phone_primary ILIKE '%' || p_term || '%'
  )
  SELECT f.clinic_patient_id, f.patient_code, f.full_name, f.date_of_birth,
         f.phone_primary, f.created_at,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION doctor_patient_list(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION doctor_patient_list(UUID, TEXT, INT, INT) TO authenticated;

-- Đếm nhanh tổng BN của 1 bác sĩ (cho thẻ thống kê).
CREATE OR REPLACE FUNCTION doctor_patient_count(p_doctor_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT count(DISTINCT a.clinic_patient_id)
  FROM appointment a
  WHERE a.doctor_id = p_doctor_id;
$$;

REVOKE ALL ON FUNCTION doctor_patient_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION doctor_patient_count(UUID) TO authenticated;

COMMIT;
