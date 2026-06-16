# SURVEY — Schema thật cho batch "Lộ trình buổi khám"

> READ-ONLY. Khảo sát ngày **2026-06-16** trên DB prod (Supabase pooler `aws-1-ap-southeast-1`,
> chỉ chạy SELECT). Mục đích: phân loại task nào chạy thẳng / cần migration / cần data / cần VPS.
> KHÔNG sửa schema, KHÔNG sửa code. Branch `feat/t-transform-01`.
>
> ⚠️ Lưu ý git state lúc khảo sát: tree KHÔNG sạch sẵn (có `context/CURRENT_PROGRESS.md`
> đang sửa + `context/SO_SANH_WEB_VS_LOI.md` chưa track) — đây là thay đổi CÓ TRƯỚC, không
> phải của survey này. Survey chỉ thêm đúng 1 file báo cáo.

---

## A. 4 BẢNG NGHI VẤN — CÓ THẬT, KHÔNG DRIFT

Worklog nghi 4 bảng này dashboard "tự tạo, không có migration". **Khảo sát bác bỏ giả định đó:**
cả 4 đều CÓ trong DB **và** CÓ file migration trong repo. Không có drift.

| Bảng | Trong DB? | Có migration? | File migration |
|---|---|---|---|
| `cskh_action` | ✅ CÓ | ✅ CÓ | `20260529_029_create_cskh_action.sql` |
| `work_roster` | ✅ CÓ | ✅ CÓ | `20260602_035_create_work_roster.sql` |
| `service_log` | ✅ CÓ | ✅ CÓ | `20260529_030_create_service_log.sql` |
| `patient_medical_profile` | ✅ CÓ | ✅ CÓ | `20260520_006_create_patient_medical_profile.sql` |

**Đối chiếu toàn bộ migration ↔ DB (STEP 3):**
- DB public có **28 bảng**. Migration khai **26 bảng** (+ `patient_summary` ở migration 018 mà
  grep `CREATE TABLE` bỏ sót do xuống dòng → thực chất **27 bảng có migration**).
- (a) Trong DB nhưng KHÔNG có CREATE TABLE migration: **chỉ `schema_migrations`** — đây là bảng
  của trình chạy migration tự sinh, KHÔNG phải drift.
- (b) Có migration nhưng KHÔNG có trong DB: **KHÔNG có bảng nào** — tức 27 bảng migration đã apply đủ.
- **Kết luận: KHÔNG có drift schema.** DB và migration khớp nhau.

Cột chi tiết 4 bảng (tóm tắt loại quan trọng):
- `cskh_action`: `status text`, `step text`, `category text`, `deadline_at`, `rating int`, các `*_link_raw` (text). Là log CSKH dạng append, link tới appointment/visit/lab/patient bằng text thô.
- `work_roster`: `work_date date`, `shift text`, `station text`, `staff_id uuid`, `staff_name text`, `sort int`. Lịch trực theo ca/trạm.
- `service_log`: `status text` (TỰ DO, không CHECK), `ordered_at`, `started_at`, `finished_at`, `result_text`, `result_form_url`, `service_name_raw`. **Đã có sẵn 3 mốc thời gian ordered→started→finished.**
- `patient_medical_profile`: `blood_type`, `allergies[]`, `chronic_diseases[]`, `current_medications[]`, `surgical_history[]`, `family_history jsonb`, `notes`. Hồ sơ nền BN.

---

## B. `lab_result` — CHƯA đủ field cho hàng đợi XN 3 trạng thái → CẦN MIGRATION (hoặc đổi nguồn)

Cột thời gian/trạng thái hiện có trong `lab_result`:

| Cột | Kiểu | Nullable | Ý nghĩa |
|---|---|---|---|
| `sample_collected_at` | timestamptz | YES | đã lấy mẫu |
| `result_received_at` | timestamptz | **NO (NOT NULL)** | đã có KQ |
| `reviewed_at` | timestamptz | YES | bác sĩ đã duyệt |
| `is_finalized` | boolean | NO | đã chốt |
| `triage_group` | text | NO | `GROUP_A/B/C/PENDING` (phân loại AI) |
| `requires_doctor_review` | boolean | NO | cần BS xem |

**Vấn đề cho 3 trạng thái "đã lấy mẫu / đã gửi lab / đã có KQ":**
1. **Thiếu mốc giữa "đã gửi lab" (sent_to_lab)** — không có cột nào cho trạng thái mẫu đã gửi ra lab nhưng chưa có KQ.
2. **`result_received_at` là NOT NULL** → một dòng `lab_result` CHỈ tồn tại khi đã có KQ.
   Nghĩa là bảng này mô hình hoá **KẾT QUẢ**, không phải **hàng đợi đang chờ**. Không thể dùng nó
   để hiển thị "mẫu đang chờ KQ".

**Hai hướng (Planner chốt):**
- **Hướng 1 — migration trên `lab_result`:** thêm `sent_to_lab_at timestamptz NULL` + ĐỔI
  `result_received_at` thành NULLABLE (để tạo dòng từ lúc lấy mẫu). Đây là ALTER → cần migration + cân nhắc RLS append-only (migration 043 khoá ghi append-only các bảng lâm sàng → phải kiểm).
- **Hướng 2 — dùng `service_log` làm hàng đợi:** `service_log` ĐÃ có `ordered_at / started_at /
  finished_at` + `status` tự do, hợp tự nhiên với 3 mốc. `lab_result` chỉ nhận KQ cuối + triage AI.
  Hướng này KHÔNG cần migration, nhưng cần chốt quy ước status và liên kết service_log ↔ lab_result.

→ **Kết luận B: hàng đợi 3 trạng thái KHÔNG chạy thẳng trên `lab_result` hiện tại.** Cần migration (Hướng 1) HOẶC đổi nguồn sang `service_log` (Hướng 2). Khuyến nghị Planner cân nhắc Hướng 2 trước (rẻ hơn, không đụng schema lâm sàng append-only).

---

## C. `visit` & `appointment` — ĐỦ cho hàng đợi buổi khám, KHÔNG cần thêm gì

**`visit.status`** (CHECK ở migration 017): `OPEN`, `IN_PROGRESS`, `FINALIZED`, `AMENDED`.
- Có thêm `checked_in_at`, `finalized_at`, `finalized_by`, `attending_doctor_id`, `work_session_id`.
- Data thật hiện tại: `IN_PROGRESS = 4`.

**`appointment.status`** (CHECK ở migration 011 + 034): `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`,
`COMPLETED`, `NO_SHOW`, `CANCELLED`, `DOCTOR_DECLINED`.
- Có `confirmed_at`, `cancelled_at`, `cancellation_reason`, `slot_start/end`, `assigned_station`, `queue_number`, `is_walkin`, `is_priority_slot`.
- Data thật: `CONFIRMED = 8`, `COMPLETED = 4`, `SCHEDULED = 1`.

→ **Kết luận C: đủ render hàng đợi bắt đầu → đang khám → hoàn tất → hủy/không đến.** Trạng thái
phong phú hơn yêu cầu (có cả DOCTOR_DECLINED, NO_SHOW). KHÔNG cần migration.

---

## D. TRANG DASHBOARD — cái nào CÓ / cái nào phải TẠO MỚI

Đường dẫn: `src/dashboard/app/(dashboard)/`. Các trang ĐÃ CÓ:

`appointments`, `cskh-today`, `customers`, `home`, **`lab-queue`** (đã có `LabQueueView.tsx`),
`patient-list`, `patients` (+ `[id]`, `new`), `reports`, `schedule` (+ `edit`),
**`service-queue`** (đã có `ServiceQueueView.tsx`), `settings` (+ `new-user`), `tasks`, `work-sessions`.

Trang CHƯA có (worklog gợi ý "tạo trang mới"):
- ❌ **Thu ngân / billing** — KHÔNG có trang. (Chỉ có `billing_tag` text trong `cskh_action`, chưa có UI.)
- ❌ **Điều dưỡng siêu âm** — KHÔNG có trang riêng. (`ultrasound_record` có bảng + migration 018, nhưng chưa có UI page.)

→ **Kết luận D:** `lab-queue` và `service-queue` ĐÃ tồn tại (chỉ cần nâng cấp logic 3 trạng thái).
Trang **thu ngân** và **siêu âm/điều dưỡng** là TẠO MỚI hoàn toàn.

---

## E. ĐƯỜNG GHI DATA — HYBRID (chủ yếu Supabase service-role, FastAPI chỉ cho AI/MPI)

- **Ghi THẲNG Supabase qua service-role** (8 route): `patients`, `lab-result`, `clinical-record`,
  `appointments`, `roster`, `admin/users`, `service-log`, `cskh-action`.
  (helper `src/dashboard/lib/supabase-service.ts`, cần `SUPABASE_SERVICE_ROLE_KEY` trên server.)
- **Qua FastAPI** (2 route): `patients/check-phone` (dedup/MPI), `brief/[id]` (AI tóm tắt trước khám,
  `API_BASE = CLINIC_API_URL ?? http://localhost:8000`).

→ **Kết luận E:** đường ghi chính của dashboard là **THẲNG Supabase service-role**, KHÔNG qua FastAPI.
FastAPI chỉ dùng cho 2 việc AI/phán đoán (brief) + chống trùng SĐT (check-phone). Lưu ý: điều này
**lệch** mô tả kiến trúc ở `CLAUDE.md §2` ("tạo BN qua FastAPI (MPI)") — thực tế `patients/route.ts`
ghi BN thẳng service-role, chỉ check-phone mới hỏi FastAPI. (Ghi nhận để Planner chốt, không sửa ở survey này.)

---

## F. KẾT LUẬN PHÂN LOẠI TASK

> Lưu ý: KHÔNG tìm thấy "file HTML" liệt kê task trong repo (`find -iname '*.html'` = rỗng). File
> task của batch "Lộ trình buổi khám" nằm NGOÀI repo (phía Planner). Dưới đây phân loại theo các
> hạng mục tính năng suy ra từ scope + `SO_SANH_WEB_VS_LOI.md`. Khi có file HTML, map task → nhóm này.

| Hạng mục tính năng | Nhóm | Lý do |
|---|---|---|
| Hàng đợi buổi khám (visit/appointment: chờ → đang khám → xong → hủy) | **CHẠY THẲNG** | status đủ (mục C), không cần migration |
| Nâng `lab-queue` / `service-queue` (trang đã có) | **CHẠY THẲNG** | trang + bảng đã tồn tại, chỉ thêm logic UI |
| **Hàng đợi XN 3 trạng thái (lấy mẫu → gửi lab → có KQ)** | **CẦN MIGRATION TRƯỚC** | `lab_result` thiếu `sent_to_lab_at` + `result_received_at` NOT NULL (mục B). HOẶC pivot sang `service_log` (khi đó hạ xuống "chạy thẳng") |
| Hồ sơ nền BN (`patient_medical_profile`) hiển thị trong lộ trình | **CHẠY THẲNG** | bảng + cột đủ |
| CSKH log / roster trong lộ trình | **CHẠY THẲNG** | `cskh_action`, `work_roster` đủ cột |
| **Trang Thu ngân / billing** | **TẠO MỚI** (chạy thẳng được, nhưng là trang mới) | chưa có trang; data `billing_tag` thô, có thể cần chốt mô hình thanh toán |
| **Trang Điều dưỡng siêu âm** | **TẠO MỚI** | chưa có trang; `ultrasound_record` đã có bảng |
| Tóm tắt trước khám (brief AI) trong lộ trình | **CẦN VPS ĐỂ SAU** | route `brief/[id]` gọi FastAPI `localhost:8000` — prod cần backend được host (`CLINIC_API_URL`) |
| Lab triage GROUP_A/B/C (AI phân loại) | **CẦN VPS ĐỂ SAU** | logic AI ở lõi Python, chưa nối UI + cần backend chạy |
| Kiểm thử trên data thật (lab/visit) | **CẦN DATA TỪ PHÒNG KHÁM** | hiện chỉ 3 lab PENDING, 4 visit, 13 appointment — quá ít để nghiệm thu hàng đợi |

---

## TÓM TẮT 5 DÒNG (cho report)
1. **4 bảng nghi vấn (cskh_action, work_roster, service_log, patient_medical_profile) CÓ THẬT, đều có migration — KHÔNG drift.** DB 28 bảng khớp 27 migration + `schema_migrations`.
2. **`lab_result` THIẾU cho hàng đợi 3 trạng thái**: không có `sent_to_lab_at`, `result_received_at` lại NOT NULL → phải migration HOẶC dùng `service_log` (đã sẵn ordered/started/finished).
3. **visit/appointment ĐỦ** cho hàng đợi buổi khám, không cần thêm gì.
4. Trang **phải tạo mới**: Thu ngân + Điều dưỡng siêu âm. `lab-queue`/`service-queue` đã có sẵn.
5. **Đường ghi data = THẲNG Supabase service-role** (8 route); FastAPI chỉ cho brief AI + check-phone (cần VPS khi lên prod).
