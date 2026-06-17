# CHANGELOG — ClinicAI Dr4Women
> Mỗi entry = 1 packet Claude Code. Mới nhất trên cùng. Mục đích: báo cáo tổng quan thay đổi.

## [LOCAL — chưa push]

### 2026-06-17 · T-DASH-TKYK-CLINICAL-01 · Role TKYK + canWriteClinical+=TKYK + siết lab/service-log · commit `chưa commit`
- **Yêu cầu phòng khám:** recap 17/6 — "Chỉ bác sĩ, điều dưỡng và thư ký y khoa có quyền điều chỉnh hồ sơ lâm sàng."
- **Đã làm:**
  - Tạo role/department **TKYK** (Thư ký Y khoa) theo pattern CASHIER (047): roles.ts (union + ALL_ROLES + ROLE_LABEL + GREET_LABEL), helper `isThuKyRole`.
  - **Migration 049**: DROP+RECREATE `staff_primary_department_check` — copy 7 value cũ (...CASHIER) + 'TKYK' = 8. Test temp schema PASS (pre/up/junk/intact/seed-idempotent/down), apply LẺ qua psql → public + insert `schema_migrations`. Seed 1 staff "Thư ký Y khoa" (guard `IF NOT EXISTS` theo full_name).
  - `canWriteClinical` (Packet 4) += `isThuKyRole` → = isDoctorRole || isNurseRole || isThuKyRole.
  - Siết 2 route lâm sàng còn rộng: `/api/lab-result` (nhập KQ XN) + `/api/service-log` (log SA/XN) đổi gate `canCheckin` → `canWriteClinical`. Lễ tân/QL bị 403; BS/ĐD/TKYK ghi được.
- **File sửa (5 code + 3 migration/seed):** lib/roles.ts · home/page.tsx · app/api/lab-result/route.ts · app/api/service-log/route.ts · CHANGELOG.md + migrations/20260617_049_staff_dept_add_tkyk.sql(+.down) + migrations/seed/049_tkyk_staff.sql.
- **Migration:** 049 apply LẺ qua psql + seed; insert ledger. KHÔNG runner sequential.
- **Boundary giữ:** migration chỉ đụng `staff_primary_department_check`; KHÔNG 043 / visit.status / FINALIZED / GROUP_C / append-only. ĐD (NURSE_ULTRASOUND) VẪN ghi lab/service (isNurseRole). KHÔNG đụng UI workqueue (để R3).
- **Nợ / next:** R3 — wire NAV/workqueue UI cho TKYK (chưa có nav → TKYK đăng nhập role-picker được nhưng chưa có màn làm việc riêng); liên kết auth cá nhân cho staff TKYK; cân nhắc thêm TKYK vào enum staff phía FastAPI (src/clinicai/schemas/staff.py) nếu sau này tạo staff qua API.

### 2026-06-17 · T-DASH-RECEPTION-FLOW-01 · Bỏ gate BS duyệt + Lễ tân sửa hành chính + rename phiếu khám · commit `chưa commit`
- **Yêu cầu phòng khám:** D21 (bỏ bước bác sĩ duyệt BN), D22 (Lễ tân sửa hành chính), + rename nhãn "Tóm tắt khám bệnh"→"Phiếu khám bệnh".
- **Đã làm:**
  - (A) D21 — Gỡ gate "BS duyệt" (workflow `appointment.status` thuần, KHÔNG dính visit.status/FINALIZED/lab/043): check-in cho phép từ `["SCHEDULED","CSKH_CONFIRMED","CONFIRMED"]` (trước: chỉ `CONFIRMED`). HomeCheckin hiện nút Check-in cho mọi lịch còn sống, bỏ chặn "Chờ bác sĩ xác nhận". → BN đến → check-in → khám được ngay. Nút "Nhận ca/Từ chối" của bác sĩ GIỮ (Từ chối → phân lại), nhưng không còn là điều kiện check-in.
  - (B) D22 — Lễ tân sửa hành chính: ĐÃ CÓ SẴN, không cần đổi code. `canWriteIntake` đã gồm RECEPTION; POST/PATCH `/api/patients` gate `canWriteIntake`/`canEditPatient`; mọi surface (/customers, /patient-list qua isTasksReadOnly, /patients/[id], /tasks) đã cấp `canEdit`/`canEditAdmin` cho RECEPTION. PatientAdminEditor chỉ sửa trường HÀNH CHÍNH (không CCCD, không lâm sàng) → `canWriteClinical` (Packet 4) giữ nguyên.
  - (C) Rename 3 chuỗi hiển thị "Tóm tắt khám bệnh"/"(tóm tắt khám)"→"Phiếu khám bệnh"/"(phiếu khám)": MedicalSummaryPrint (tiêu đề in), ClinicalRecordForm (header panel), patients/[id] (mô tả). KHÔNG đổi tên biến/route/key/cột. KHÔNG đụng "Tóm tắt trước khám" (PreVisitBrief) / "Tóm tắt kết quả" (lab) — khác nghĩa.
- **File sửa (5):** app/api/appointments/route.ts · app/(dashboard)/home/HomeCheckin.tsx · app/print/[appointmentId]/MedicalSummaryPrint.tsx · app/(dashboard)/tasks/ClinicalRecordForm.tsx · app/(dashboard)/patients/[id]/page.tsx.
- **Migration:** none.
- **Boundary giữ:** gate BS duyệt = hành chính thuần (appointment.status) — gỡ an toàn; KHÔNG đụng 043/visit.status/FINALIZED/lab; Lễ tân chỉ chạm hành chính (canWriteClinical nguyên); rename chỉ chuỗi hiển thị.
- **Nợ / next:** confirm/decline của bác sĩ giờ tuỳ chọn (work_roster auto-insert vẫn gắn với `confirm` — bác sĩ không nhận ca sẽ không tự lên Lịch làm việc; nếu muốn bỏ hẳn UI nhận ca thì packet riêng). Comment file header vẫn ghi "TÓM TẮT KHÁM BỆNH" (giữ — boundary chỉ đổi chuỗi hiển thị).

### 2026-06-17 · T-DASH-CLINICAL-PERM-SIET-01 · Lâm sàng chỉ BS+ĐD, tách check-in khỏi vitals · commit `chưa commit`
- **Yêu cầu phòng khám:** chốt họp — CHỈ Bác sĩ + Điều dưỡng được chỉnh lâm sàng (sửa lại nới quá rộng ở Packet 2 cho mọi role `canCheckin`).
- **Đã làm:**
  - Thêm helper `canWriteClinical(role) = isDoctorRole || isNurseRole` trong roles.ts (`isNurseRole` đã có sẵn = NURSE_ULTRASOUND).
  - Route `/api/clinical-record`: gate nhánh vitalsOnly đổi `canCheckin`→`isNurseRole` → `isDoctorRole(role) || (vitalsOnly && isNurseRole(role))`. Lễ tân/QL bị 403 khi ghi lâm sàng.
  - UI: HomeCheckin nhận `canWriteClinical`, truyền `readOnly={!canWriteClinical}` cho ClinicalRecordForm → Lễ tân/QL xem hồ sơ lâm sàng chỉ-đọc (vitals + lý do khoá, ẩn nút Lưu).
  - TÁCH check-in (hành chính) khỏi ghi vitals (lâm sàng): check-in vẫn ở `/api/appointments` action=checkin (gate `canCheckin`) — Lễ tân/QL/ĐD vẫn đón khách bình thường.
- **File sửa (4):** lib/roles.ts · app/api/clinical-record/route.ts · app/(dashboard)/home/HomeCheckin.tsx · app/(dashboard)/home/page.tsx.
- **Migration:** none (app-layer thuần, không đụng RLS).
- **Boundary giữ:** không migration / không RLS / không đụng 043 / visit.status / FINALIZED (vẫn qua WRITABLE_VISIT_STATUSES). BS save full hồ sơ KHÔNG đổi (isDoctorRole bỏ qua vitalsOnly). DoctorWorkBoard & PatientListView vốn đã readOnly cho non-doctor — không leak.
- **Nợ / next:** lab-result + service-log vẫn gate `canCheckin` (ngoài scope — ĐD nhập KQ XN/log SA; nếu muốn siết tiếp thì packet riêng).

### 2026-06-17 · T-DASH-NURSE-PERM-01 · ĐD sửa lý do khám + vital required HA/CN/CC · commit `chưa commit`
- **Yêu cầu phòng khám:** D25 (STT 15.0) cho điều dưỡng sửa "Lý do khám bệnh"; D26 (STT 16.0) chỉ 3 sinh hiệu bắt buộc.
- **Đã làm:**
  - (A) "Lý do khám bệnh" (Section II = `chief_complaint`, BS đưa ra/ĐD nhập hộ) mở quyền sửa cho luồng đón-khám: ô đổi `disabled` từ `roRest`→`ro`; `saveVitals()` gửi kèm `chief_complaint`; route `/api/clinical-record` nhánh `vitalsOnly` ghi `chief_complaint_at_visit` (CHỈ khi non-empty → không xoá lý do BS đã ghi).
  - (B) Sinh hiệu: thêm bắt buộc CHỈ 3 trường Huyết áp / Cân nặng / Chiều cao (dấu `*` + viền đỏ + chặn lưu khi thiếu); các vital khác giữ optional (vốn chưa từng required).
  - Xác nhận tách bạch 2 trường: "Vấn đề khiến BN đi khám" (CSKH lúc đặt lịch) KHÔNG tồn tại trong code → không đụng nhầm.
- **File sửa (2):** app/(dashboard)/tasks/ClinicalRecordForm.tsx · app/api/clinical-record/route.ts.
- **Migration:** none (validation frontend + ghi qua route service-role sẵn có).
- **Boundary giữ:** quyền xử ở APP-LAYER (route gate `vitalsOnly && canCheckin`, KHÔNG đụng RLS); KHÔNG đụng visit.status/FINALIZED gate (vẫn chặn qua WRITABLE_VISIT_STATUSES)/lab_result/043.
- **Nợ / next:** quyền mở cho mọi role `canCheckin` (ĐD/Lễ tân/QL) theo kiến trúc vitalsOnly sẵn có — nếu cần CHỈ điều dưỡng thì siết riêng sau; required HA/CN/CC enforce ở luồng đón-khám (save của bác sĩ không chặn).

### 2026-06-17 · T-DASH-GENDER-KHAC-02 · Giới tính "Khác" + bootstrap CHANGELOG · commit `chưa commit`
- **Yêu cầu phòng khám:** D13 (giới tính cần lựa chọn "Khác" ngoài Nam/Nữ).
- **Đã làm:**
  - Migration 048 nới `patient_gender_check` → chấp nhận `'Nam'/'Nữ'/'Khác'` (giữ NULL).
  - Test temp schema PASS (pre-reject → up-accept → junk-reject → Nam/Nữ intact → down-revert), rồi apply lẻ vào public + insert ledger.
  - Thêm `<option>Khác` vào 3 dropdown giới tính (NewPatientForm, PatientAdminEditor, ConfirmBoard).
  - Verify write path: `/api/patients` không có allowlist gender → `'Khác'` ghi DB OK (smoke insert chỉ vướng patient_code auto-gen, gender check PASS).
- **File sửa (4 + 2 migration + 1 changelog):** NewPatientForm.tsx · PatientAdminEditor.tsx · ConfirmBoard.tsx · (CHANGELOG.md mới) · migrations/20260617_048_patient_gender_add_khac.sql(+.down).
- **Migration:** 048 apply LẺ qua psql (BEGIN/COMMIT), insert `schema_migrations`. Không chạy runner sequential.
- **Boundary giữ:** chỉ DROP+RECREATE đúng 1 constraint `patient_gender_check`; KHÔNG đụng cột/constraint khác, KHÔNG đụng 043 (vẫn lỗ), không đổi giá trị Nam/Nữ đang lưu (10 Nữ / 7 NULL).
- **Nợ / next:** down 048 chỉ an toàn khi chưa có BN gender='Khác'; 043 vẫn pending (đợt riêng).

### 2026-06-17 · T-DASH-INTAKE-UX-01 · UX form intake (PT, tên BS, search bỏ dấu, date) · commit `08365f6`
- **Yêu cầu phòng khám:** D11 (nhãn PT + tên BS đầy đủ + tìm không dấu), D19 (ô ngày DD/MM/YYYY).
- **Đã làm:**
  - (a) `PT`→`Phẫu thuật` (ClinicalRecordForm); bác sĩ hiển thị HỌ TÊN ĐẦY ĐỦ (WeeklyAppointmentsTable bỏ in-hoa/viết-tắt; heading /appointments dùng full_name).
  - (b) Tìm tên KHÔNG phân biệt dấu: tái dùng cột `full_name_unaccent` (migration 039) cho customers/page (server, có fallback); lọc client HomeCheckin + StaffPicker qua `unaccentVi`; gom `unaccentVi` vào lib/validation.
  - (c) [DỪNG ở packet này] Giới tính "Khác" bị CHECK chặn → chuyển sang packet T-DASH-GENDER-KHAC-02.
  - (d) Component `DateField` dùng chung: 1 ô DD/MM/YYYY, tự đệm 0 (7→07), nút lịch native, emit ISO (DB date không đổi); gộp 3 ô DOB rời; áp cho DOB + ngày khám ở NewPatientForm/AppointmentBooking/PatientAdminEditor.
- **File sửa (12):** DateField.tsx (mới) · lib/validation.ts · NewPatientForm.tsx · AppointmentBooking.tsx · PatientAdminEditor.tsx · WeeklyAppointmentsTable.tsx · HomeCheckin.tsx · appointments/page.tsx · ClinicalRecordForm.tsx · customers/page.tsx · PatientsList.tsx · StaffPicker.tsx.
- **Migration:** none (chỉ tái dùng cột 039 sẵn có).
- **Boundary giữ:** frontend-only; KHÔNG migration, KHÔNG đổi schema/RLS/route ghi; search tái dùng cột sẵn có (không đổi DB).
- **Nợ / next:** nghiệm thu mắt DateField trên local (gõ tay + chọn lịch + "Chỉ biết năm").
