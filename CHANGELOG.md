# CHANGELOG — ClinicAI Dr4Women
> Mỗi entry = 1 packet Claude Code. Mới nhất trên cùng. Mục đích: báo cáo tổng quan thay đổi.

## [LOCAL — chưa push]

### 2026-06-18 · T-DASH-CSKH-FOLLOWUP-01 · Danh sách BN cần nhắc gọi (bucket 2/10/20/30 ngày) + nút "Đã gọi" · commit `chưa commit`
- **Yêu cầu phòng khám:** trong màn CSKH ("Cần làm hôm nay"), thêm danh sách BN quá hạn/không phản hồi chia bucket theo số ngày + nút "Đã gọi" ghi nhật ký CSKH.
- **Anchor (TÁI DÙNG, không định nghĩa mới):** `tai_kham.ngay` (soap_plan, cùng nguồn `dueLimit` khối ③). Quá hạn = `today − tai_kham.ngay` (ngày). Dùng lại đúng tập `recalls` đã loại BN có lịch hẹn tương lai.
- **Bucket:** `FOLLOWUP_TIERS = [2,10,20,30]` khai 1 chỗ đầu `cskh-today/page.tsx`. `buildFollowupBuckets` xếp mỗi BN vào ngưỡng quá-hạn cao nhất khớp (≥30 / ≥20 / ≥10 / ≥2 ngày); <2 ngày bỏ qua (vẫn ở khối ③ tái khám thường).
- **Action "Đã gọi":** route mới `app/api/cskh-followup/route.ts` (POST `{clinic_patient_id}`) → INSERT 1 dòng `cskh_log` (TÁI DÙNG cột `cskh_status="Đã gọi nhắc tái khám"` + `cskh_followup="Nhắc gọi tái khám"` + `last_cskh_date`+`cskh_by`), service-role (cskh_log RLS SELECT-only), gate `canWriteIntake`, có `logEvent`. Hiện ngay trong nhật ký CSKH của BN (`PatientCskhLog`).
- **UI:** client `CskhFollowupList.tsx` group theo bucket, mỗi dòng BN + nút "Đã gọi" (busy guard, optimistic "✓ Đã ghi", `router.refresh()` sau bấm). Section mới ③b trong page (server tính bucket, truyền xuống client).
- **Boundary giữ:** KHÔNG migration (cskh_log/cskh_followup đã có mig 037); KHÔNG đụng visit.status/FINALIZED/043/lâm sàng; KHÔNG đụng home/VisitProgress*. Build: tsc/eslint/next build Errors:0.
- **Nợ:** hiện DB có **0** visit với `soap_plan.tai_kham.ngay` → bucket rỗng tới khi BS điền ngày tái khám (data contract mới, chưa có data thật — giống khối ③). "Không phản hồi" hiện = quá hạn theo ngày; chưa lọc theo "đã gọi gần đây" (có thể chặn spam gọi lại ở Phase sau bằng cách đọc `cskh_log.last_cskh_date`).

### 2026-06-18 · T-DASH-LETAN-PROGRESS-01 · Progress stepper + đồng hồ chờ đổi màu (board Lễ tân) · commit `chưa commit`
- **Yêu cầu phòng khám:** board theo dõi BN của Lễ tân cần (a) thanh tiến trình các mốc khám, (b) đồng hồ chờ đổi màu theo thời gian. THUẦN PRESENTATIONAL, đọc data sẵn có.
- **Target = `VisitStatusBoard`** (board read-only "Trạng thái BN buổi khám" cho Lễ tân, `home/page.tsx` `isReception`) — vì nó có `visit.status` + `checked_in_at`. HomeCheckin (hàng đợi appointment) KHÔNG có `checked_in_at` nên không đặt đồng hồ ở đó.
- **Mới `VisitProgress.tsx`** (client island):
  - `ProgressStepper(status)`: 7 mốc Hẹn→Xác nhận→Check-in→Đang khám→Chờ SA/XN→Chờ thanh toán→Xong. Backed (CÓ data): Hẹn/Xác nhận/Check-in (ngầm DONE vì visit chỉ tồn tại sau check-in) + **Đang khám** (`visit.status=IN_PROGRESS`; FINALIZED/AMENDED = done). XÁM/inactive (chưa data): **Chờ SA/XN** (chưa join sono/lab) + **Chờ thanh toán** + **Xong** (chờ billing) — title tooltip ghi rõ lý do. KHÔNG bịa data.
  - `WaitClock(checkedInAt, active)`: `setInterval` 1s client tính `now − checked_in_at`, hiển thị `mm:ss`, đổi màu theo **ngưỡng hằng số đầu file** (`WAIT_GREEN_MAX=10`, `WAIT_YELLOW_MAX=20`): <10p xanh / 10–20p vàng / >20p đỏ. Chỉ chạy khi OPEN/IN_PROGRESS; FINALIZED/AMENDED → dừng ("—"). Guard `nowMs=null` tới khi mount → tránh hydration mismatch. Cleanup `clearTimeout`+`clearInterval` khi unmount.
- **`VisitStatusBoard.tsx`:** thêm 2 cột "Chờ" (WaitClock) + "Tiến trình" (ProgressStepper), colSpan empty 5→7. KHÔNG đụng logic/badge cũ.
- **Boundary giữ:** KHÔNG thêm/sửa enum status, KHÔNG migration, KHÔNG ghi DB, KHÔNG đụng visit.status/FINALIZED/043/lâm sàng. Đồng hồ thuần client từ `checked_in_at`.
- **Build:** tsc 0 lỗi · eslint 0 lỗi (sửa `react-hooks/set-state-in-effect`: tick đầu qua `setTimeout(0)`) · next build Errors:0.
- **Nợ:** 2 mốc cuối "Chờ thanh toán"/"Xong(thu ngân)" + "Chờ SA/XN" render xám tới khi build billing + nối hàng đợi sono/lab vào board. HomeCheckin (appointment) chưa có stepper/đồng hồ (thiếu checked_in_at — sẽ cần join visit nếu muốn).

### 2026-06-17 · T-DATA-CHIDINH-CATALOG-SEED-01 · Seed danh mục CLS + thuốc từ PHIẾU CHỈ ĐỊNH (PK) + nối picker form khám · commit `chưa commit`
- **Nguồn:** `scripts/catalog_src/PHIEU_CHI_DINH_update.docx` (PK gửi). Parser `scripts/parse_chidinh_catalog.py` (python-docx) → `scripts/catalog_out/{services,drugs}.csv` (gitignore `*.csv` — regen bằng chạy lại script).
- **Parse:** **29 dịch vụ/CLS** (Table0+1 theo nhóm-cột: Tầng 1 / Thủ thuật / Chụp phim ngoài / Thai / Nội tiết–phụ khoa; gộp 1 dòng trùng "Đo mật độ xương") + **64 thuốc** (Table2, 9 dòng-nhóm L1–L9; splitter tôn trọng ngoặc → giữ `Letrozole (10v, 15v)`, tách `;` cho `Diphereline…; GonaF`). **needs_review=TRUE: 3** (`Fes 1/10`, `Utrogestan (Đ) (1v/2v): (U)`, `Difavon/Diflucan/Fluconazole/Zolmed`). KHÔNG bỏ sót dòng nào.
- **Migration 051** (`20260617_051_create_drug_catalog_and_cls_seed.sql` + `.down.sql`):
  - TẠO MỚI `drug_catalog` (name_base, name_raw UNIQUE verbatim, variant, group_label, **unit_price NULL**, needs_review, is_active, created_at) + RLS SELECT authenticated. (Cột `prescription.drug_catalog_ref` mig 031 đã chờ sẵn.)
  - `service_price`: **ADD COLUMN** `category` + `tang` (nullable → KHÔNG đụng rows cũ) để picker CLS gom nhóm theo group_label.
  - Seed 64 thuốc (giá NULL, `ON CONFLICT(name_raw) DO NOTHING`) + 29 dịch vụ NEW vào `service_price` group='dich_vu' (giá NULL, `ON CONFLICT("group",service_code) DO NOTHING`, service_code = `CLS_<slug>`). SQL sinh bởi `scripts/gen_catalog_seed_sql.py` (deterministic).
  - **Apply LẺ out-of-band**: psql trực tiếp (INSERT 64 + 29, COMMIT) → `apply_migrations.py --mark-applied`. **KHÔNG sequential-to-max.** Verify sau apply: **has_043=False** (lỗ 043 còn nguyên), has_051=True, drug_catalog=64, service_price dich_vu=29.
- **Wire picker (dùng chung 5 form pk/sk/nt/nk/hmvs):** route mới `app/api/catalog/route.ts` (GET, đọc-only) → `{drugs, cls}`. `ClinicalRecordForm.tsx`: fetch 1 lần, 2 `<datalist>` (options BƠM RUNTIME, KHÔNG hardcode vào schema tĩnh): input "Đơn thuốc" (mục IX) `list=drug-catalog-list` (name_raw + nhãn variant/⚠cần dược); input "Chỉ định CLS" (mục VI) `list=cls-catalog-list` (name + nhãn category). Giữ gõ tự do (catalog là MENU, không phải safety gate) → persist qua đường có sẵn (prescription / lab_result).
- **Build:** tsc 0 lỗi · eslint 0 lỗi (file đổi) · next build Errors:0.
- **Boundary giữ:** giá NULL (không bịa); name_raw verbatim; chỉ THÊM dịch vụ NEW (rows/giá cũ không đụng); KHÔNG chạm 043/visit.status/FINALIZED/lâm sàng; KHÔNG push.
- **Nợ:** giá lazy-fill ở màn Thu ngân (toàn bộ 93 row unit_price NULL); 3 thuốc needs_review chờ DƯỢC xác nhận biến thể/định danh; variant tách best-effort (vd `Đ`=đặt/`U`=uống) nên dược rà; root còn bản docx trùng `PHIẾU CHỈ ĐỊNH - update.docx` (bản chuẩn đã ở `scripts/catalog_src/`) — Quang xoá bản root nếu muốn.

### 2026-06-17 · T-DASH-BO-BS-CHIDINH-01 · Gỡ UI "Bác sĩ phụ trách chỉ định" → NO-OP (field chưa từng tồn tại) · commit `chưa commit`
- **Yêu cầu phòng khám (họp 17/6):** bỏ field/label "Bác sĩ phụ trách chỉ định" (thuật ngữ sai), GIỮ "Chỉ định CLS".
- **Kết quả khảo sát:** label này **KHÔNG tồn tại** trong code dashboard và **chưa từng tồn tại**.
  - Grep literal `"Bác sĩ phụ trách chỉ định"` toàn repo (trừ node_modules/.next): 0 hit.
  - `git log -S "Bác sĩ phụ trách chỉ định"` / `-S "phụ trách chỉ định"`: 0 commit → chưa bao giờ vào code.
  - Chuỗi "phụ trách" chỉ ở 2 chỗ KHÁC target: `print/sono/[id]/SonoResultPrint.tsx:167` (dòng ký tên footer phiếu in) + `api/clinical-record/route.ts:297` (comment). Các `<label>Bác sĩ</label>` (AppointmentBooking/NewPatientForm/ConfirmBoard) = dropdown PHÂN BÁC SĨ cho lịch hẹn, lõi luồng đặt lịch — KHÔNG đụng.
- **"Chỉ định CLS" còn nguyên:** = các section "Cận lâm sàng" (field `cls_*`) trong `lib/form-schemas/{pk,nt,nk,sk,hmvs}.ts`.
- **Kết luận:** R4 = **no-op**. Field chỉ sống trong doc thiết kế/recap họp, chưa bao giờ build vào UI. KHÔNG sửa code, KHÔNG migration, KHÔNG drop cột (đúng boundary). Quyết định "đóng no-op" do Quang chốt.
- **Nợ:** không có cột mồ côi để dọn (vì chưa từng build). Nếu PK vẫn thấy field này ở đâu đó → đang nhìn bản mockup/doc cũ, không phải dashboard hiện hành.

### 2026-06-17 · T-DASH-TRUONGCA-01 · Role Trưởng ca (hành chính, KHÔNG lâm sàng) · commit `chưa commit`
- **Yêu cầu phòng khám:** thêm vai "Trưởng ca" (quản 1 ca/ngày, thay phiên) = quyền HÀNH CHÍNH như Lễ tân/CSKH, TUYỆT ĐỐI không lâm sàng.
- **Đã làm:**
  - Role/department **TRUONG_CA** mirror CASHIER/QL: roles.ts (union + ALL_ROLES + ROLE_LABEL + GREET_LABEL + helper isTruongCaRole) + NAV.
  - **Migration 050**: DROP+RECREATE staff_primary_department_check — 8 value cũ (...TKYK) + 'TRUONG_CA' = 9. Test temp schema PASS (pre/up/junk/intact/down), apply LẺ qua psql (per-file, KHÔNG replay 042-049, KHÔNG chạm 043) + insert schema_migrations. Seed 1 staff "Trưởng ca" (guard IF NOT EXISTS).
  - **Quyền:** `canWriteIntake += TRUONG_CA` → sửa intake + hồ sơ hành chính (qua canEditPatient) ở /customers, /patients/[id], /patients/new, PATCH/POST patients. `canWriteClinical` GIỮ NGUYÊN (BS+ĐD+TKYK) — TRUONG_CA KHÔNG ghi lâm sàng.
  - **UI:** trang `/truong-ca` "Theo dõi buổi" READ-ONLY (tái dùng VisitStatusBoard, visit hôm nay, không nút mutate) + `/truong-ca/cong-viec` placeholder "Công việc của tôi" (Đang xây dựng — chờ mẫu báo cáo PK 24/6). Nav 2 mục mới.
- **File sửa (5 code + 3 migration/seed):** lib/roles.ts · home/page.tsx · nav-items.ts · truong-ca/page.tsx (mới) · truong-ca/cong-viec/page.tsx (mới) + migrations 050(.sql/.down) + seed/050.
- **Migration:** 050 apply LẺ qua psql + seed; insert ledger. KHÔNG runner sequential, KHÔNG chạm 043.
- **Boundary giữ:** KHÔNG visit.status/FINALIZED/043/logic lâm sàng; KHÔNG thêm TRUONG_CA vào canWriteClinical; KHÔNG sửa migration đã merged; KHÔNG đụng FastAPI.
- **Nợ / next:** auth cá nhân cho staff Trưởng ca (hiện shared-login + role-picker); nội dung thật "Công việc của tôi" chờ mẫu báo cáo PK 24/6; cân nhắc thêm TRUONG_CA vào enum staff FastAPI nếu sau tạo staff qua API.

### 2026-06-17 · T-DASH-LETAN-WORKQUEUE-01 · Màn làm việc Lễ tân (hàng chờ + nút hành động) · commit `chưa commit`
- **Yêu cầu phòng khám:** triết lý "màn hình làm việc, không phải bảng trạng thái — mỗi nút = 1 việc thật". Hàng chờ hôm nay có nút đổi theo pha.
- **Đã làm:**
  - Nâng HomeCheckin (/home) từ read-only → hàng đợi TƯƠNG TÁC. Cột: Bệnh nhân · Giờ hẹn · Trạng thái (nhãn VN) · Nút hành động.
  - Nút theo pha (mỗi nút 1 action tái dùng /api/appointments, chặn double-click qua busyId, refetch router.refresh sau bấm):
    SCHEDULED → "Gọi xác nhận" (`cskh_confirm`); CSKH_CONFIRMED/CONFIRMED → "Check-in" (`checkin`); CHECKED_IN → "Đang chờ bác sĩ khám" + Hoàn tác (`undo_checkin`); COMPLETED → In phiếu; +"Không đến" (`no_show`) ở pha trước khi đến.
  - Nhãn trạng thái VN (STATUS_VN) cho cột Trạng thái.
- **File sửa (1 + CHANGELOG):** app/(dashboard)/home/HomeCheckin.tsx.
- **Migration:** none. Route: KHÔNG thêm action mới — TÁI DÙNG cskh_confirm/checkin/undo_checkin/no_show sẵn có.
- **Quyết định (đã hỏi Planner):** nút "Đưa vào khám" cho CHECKED_IN cần 1 pha trung gian KHÔNG có trong enum (CHECKED_IN→COMPLETED, không "đang khám"). Chọn **không migration**: CHECKED_IN = ĐÃ vào hàng khám của bác sĩ (DoctorWorkBoard đã hiện) → bỏ nút đổi-pha, chỉ hiện "Đang chờ bác sĩ khám" + Hoàn tác.
- **Boundary giữ:** workqueue HÀNH CHÍNH (gate canWriteIntake/canCheckin của route sẵn có); KHÔNG đụng visit.status/FINALIZED/GROUP_C/043/ghi lâm sàng; TKYK (vai lâm sàng) không thấy màn này (home showCheckin=canCheckin). Nút chỉ hiện đúng pha (state machine).
- **Nợ / next:** nếu PK muốn tách rõ "đã đến" ⟂ "đang khám" → packet riêng thêm status IN_EXAM (migration lẻ) + action to_exam + cập nhật DoctorWorkBoard. Walk-in SCHEDULED hiện cần Gọi xác nhận → Check-in (2 bước) đúng mapping ảnh; nếu muốn 1 bước cho khách tới trực tiếp thì refine sau.

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
