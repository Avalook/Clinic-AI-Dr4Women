-- Migration 063 — "Đợt khám" (care_episode): lớp gom nhiều LƯỢT cùng một vấn đề/dịch vụ.
-- Task: T-20260629-EPI-01. Mục tiêu: biến phán đoán mờ "khám mới hay tái khám?" thành
-- một TRẠNG THÁI rõ ràng do con người chốt, làm proxy tải BS Thành chuẩn hơn cho engine
-- ngân sách (CAP-01). Xem memory [[capacity-budget-patient-kind]], [[bottleneck-thanh-fragment-model]].
--
-- 3 lớp: bệnh nhân (1) → ĐỢT KHÁM theo dịch vụ (lớp này) → lượt khám (visit/appointment).
--   OPEN          = đang theo dõi → lượt mới gắn vào = Tái khám (RETURN, nhẹ tải).
--   PENDING_CLOSE = BS khám xong KHÔNG hẹn lần sau → CHỜ CSKH xác nhận đóng.
--   CLOSED        = đã kết thúc → lượt sau cùng dịch vụ = Khám mới (NEW, mở đợt mới).
--
-- ADDITIVE-ONLY: chỉ CREATE TABLE mới + ADD COLUMN nullable. KHÔNG sửa/bỏ cột cũ.
-- SAU KHI CHẠY: NOTIFY pgrst, 'reload schema';  (nếu không màn trống — memory postgrest-reload-after-ddl)

BEGIN;

CREATE TABLE IF NOT EXISTS care_episode (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_patient_id     uuid NOT NULL REFERENCES patient(clinic_patient_id) ON DELETE RESTRICT,
  service_type_id       uuid NOT NULL REFERENCES service_type(id),
  status                text NOT NULL DEFAULT 'OPEN'
                          CHECK (status IN ('OPEN', 'PENDING_CLOSE', 'CLOSED')),
  opened_at             timestamptz NOT NULL DEFAULT now(),
  opened_appointment_id uuid REFERENCES appointment(id),
  last_visit_at         timestamptz,                       -- mốc lượt gần nhất (nuôi auto-đóng)
  closed_at             timestamptz,
  close_reason          text CHECK (close_reason IN
                          ('doctor_no_followup', 'cskh_confirmed', 'manual', 'new_problem', 'auto_inactive')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE care_episode IS
  'Đợt khám: gom nhiều lượt cùng một vấn đề/dịch vụ. Trạng thái đợt quyết định mặc định NEW/RETURN cho lượt kế.';

-- Mỗi (BN, dịch vụ) chỉ có TỐI ĐA 1 đợt còn sống (OPEN hoặc PENDING_CLOSE).
-- Partial unique → đợt đã CLOSED không chặn việc mở đợt mới cùng dịch vụ.
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_episode_live
  ON care_episode (clinic_patient_id, service_type_id)
  WHERE status <> 'CLOSED';

CREATE INDEX IF NOT EXISTS idx_care_episode_lookup
  ON care_episode (clinic_patient_id, service_type_id, status);

-- Gắn lượt hẹn vào đợt. NULL = lịch cũ trước khi có lớp đợt (tương thích ngược).
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS episode_id uuid REFERENCES care_episode(id);

COMMENT ON COLUMN appointment.episode_id IS
  'Đợt khám mà lượt hẹn này thuộc về. Mở/gắn lúc đặt lịch theo patient_kind.';

COMMIT;

-- BẮT BUỘC sau khi chạy (không thì PostgREST cache cũ → màn trống dù data còn):
--   NOTIFY pgrst, 'reload schema';
