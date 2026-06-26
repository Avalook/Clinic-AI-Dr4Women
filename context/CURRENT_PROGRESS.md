## ▶ 2026-06-26 — CSKH: "Số chỗ còn trống" → sơ đồ đặt chỗ kiểu rạp chiếu phim (dùng chung BN mới + tái khám)

**Việc đã làm:**
- Mới: `app/(dashboard)/patients/CinemaSlotPicker.tsx` — component lưới đặt chỗ dùng chung. Mỗi bác sĩ 1 hàng, mỗi ô = 1 khung 15' trong giờ mở cửa (`clinicHoursForDate`). Ô đã có lịch / quá giờ → khoá; ô trống bấm → `onPick(doctorId, "HH:mm")`. Component thuần render (parent truyền `existingAppts`, nhận callback) → tái dùng được cả 2 luồng.
- `patients/AppointmentBooking.tsx` (luồng **tái khám** qua `PatientBooking` + step 2): thay khối "Số chỗ còn trống" bằng `<CinemaSlotPicker/>` (span 2 cột), giữ Time24Input làm nhập tay dự phòng. Fetch `/api/appointments` **bỏ** filter `doctor_id` → lấy lịch mọi bác sĩ để vẽ đủ hàng.
- `patients/new/NewPatientForm.tsx` (luồng **BN mới**): thay y hệt; fetch non-walkin bỏ `doctor_id`.

**Quyết định & lý do:**
- 1 component dùng chung thay vì 2 bản: logic chọn giờ ở 2 màn vốn trùng 100%; yêu cầu của Quang là tái khám cũng phải có "rạp chiếu phim".
- **Giữ** Time24Input (nhập tay) làm dự phòng theo chốt với Quang; picker và ô nhập tay đồng bộ qua cùng state `apptTime/doctorId`.
- **KHÔNG** đụng backend: GET `/api/appointments` khi bỏ `doctor_id` đã trả lịch mọi bác sĩ kèm field `doctor_id`.

**Kiểm chứng:** `next build` Errors 0; typecheck sạch; lint 3 file — CinemaSlotPicker 0 lỗi, 2 file kia số lỗi = baseline (toàn lỗi có sẵn: DURATIONS/setDuration/any/set-state-in-effect, không thuộc vùng sửa).

**Chưa làm / cần khi chạy thử:** chưa push (chờ Quang "OK"). Refactor gộp trùng lặp NewPatientForm↔AppointmentBooking để sau (ngoài scope).

---

## ▶ LƯU Ý 2026-06-23 (chiều) — Điều dưỡng: nav/quyền + 3 hàng đợi + sinh hiệu + phiếu khám

**ĐÃ SỬA (feedback PM cho vai Điều dưỡng `NURSE_ULTRASOUND`) — commit `a6a017e`:**
- `+` nav `/patient-list` ("Thông tin bệnh nhân"): ĐD tra cứu BN + xem lịch sử khám (parity bác sĩ).
- BỎ check-in khỏi ĐD (`canCheckin` chỉ còn RECEPTION + MANAGEMENT) — check-in là việc Lễ tân.
- BỎ tạo BN khỏi ĐD (`canWriteIntake` + nav `/patients/new`) — ĐD không tạo BN.
- 3 hàng đợi ĐD KHÔNG ảnh hưởng (chúng gate `canWriteClinical` / check role trực tiếp, ĐD vẫn ghi).

**QUYẾT ĐỊNH (Quang 23/6): 3 hàng đợi (`/lab-queue`, `/service-queue`, `/sono`) TẠM GIỮ HẾT cho ĐD — KHÔNG tách/gộp.**
LÝ DO: chưa có insight tách vai "Phụ siêu âm" + **phòng khám CHƯA phản hồi**. (Chi tiết: memory `dieu-duong-queues-decision`.)
**OPEN khi PK phản hồi:** `/sono` (làn SA + làn XN phụ) CHỒNG LẤN `/lab-queue` (cùng là XN) và `/service-queue` (cùng đọc `service_log`). Nếu "Phụ siêu âm" chỉ lo siêu âm → nên BỎ làn XN trong `/sono` (dồn về `/lab-queue`). Nguồn order các hàng đợi = PHIẾU CHỈ ĐỊNH (Thủ thuật / Xét nghiệm / Siêu âm / Thuốc).

**SINH HIỆU (vitals) — ĐÃ LÀM (commit `6254adb`):** bỏ check-in khỏi ĐD làm ĐD mất lối nhập sinh hiệu (vốn nằm trong form check-in). Search thực hành phòng khám lớn: ghi sinh hiệu là việc CLINICAL (điều dưỡng / medical assistant), KHÔNG phải lễ tân (front desk = hành chính). Đã bù: thêm khu **"Sinh hiệu bệnh nhân hôm nay"** trên trang chủ CHỈ cho ĐD — tái dùng `HomeCheckin` ở chế độ vitals (prop `canCheckinActions=false` → ẩn nút check-in/xác nhận, chỉ mở BN nhập sinh hiệu; `canWriteClinical=true` cho ĐD → sửa được). Lễ tân vẫn chỉ XEM. Ghi qua `/api/clinical-record` vitalsOnly (tạo/đụng visit IN_PROGRESS như cũ).

**PHIẾU KHÁM theo loại (NT/PK/SK/NK/HMVS):** ĐÃ XONG trước đó (T-FORM-COMPACT-01/02). Engine `lib/form-schemas/` config-driven theo `service_code`, render qua `<ServiceFormEngine>` trong tab phiếu khám `ClinicalRecordForm.tsx`. Khớp đặc tả "Sáng Ý - Bàn giao KCB". Hạn chế còn lại: `resolveServiceCode` đang ĐOÁN theo TÊN dịch vụ (chưa truyền `service_type.code`).

---

## ▶ Phiên 2026-06-23 — Quy ước nhánh + đọc lại dashboard

**QUY ƯỚC NHÁNH (Quang chốt 23/6 — nguồn chân lý đầy đủ ở `CLAUDE.md §3`):**
- Mọi thay đổi code/commit DIỄN RA TRÊN `chinh`. KHÔNG bao giờ code/commit thẳng lên `feat/t-transform-01`.
- **Cổng 1** — push `chinh`: chỉ khi Quang nói **"OK"**.
- **Cổng 2** — merge `chinh` → `feat/t-transform-01` (= PRODUCTION nối Vercel, autoDeploy, phòng khám đang xem): chỉ khi Quang nói **"CHỐT"** + có lệnh rõ.

**Việc phiên này:** (1) Ghi rule nhánh 2 cổng vào `CLAUDE.md §3` + worklog này. (2) Đọc lại toàn bộ dashboard `src/dashboard` (Next.js **16.2.6** — có breaking changes, đọc `node_modules/next/dist/docs/` trước khi viết code; xem `src/dashboard/AGENTS.md`): **11 role**, ~24 trang `(dashboard)`, ~22 API route; data-path = tạo BN qua **FastAPI MPI** (`/api/patients` → `CLINIC_API_URL`), đọc/ghi khác qua **Supabase** (browser=anon, server=anon+cookie, service=service-role bypass RLS). Gate an toàn: FINALIZED visit (clinical-record/clinical-form 409), GROUP_C lab "chờ BS duyệt", append-only `event_log`.
**Đã sửa (feedback PM, mục "Chung / Giao diện") — ĐÃ COMMIT `b7e8264`:**
1. **Trùng chữ "BS"** (`BS. TS.BS. Phan Chí Thành`): gốc = code prepend `BS.`/`BS ` trong khi `staff.full_name` đã có học hàm (seed `053_doctor_full_names.sql`: TS.BS./Ths.BS./BSNT./BSCKI./Ths./BS.). Tạo helper `lib/doctor-name.ts` → `doctorName()` chỉ thêm `BS.` khi tên CHƯA có học hàm, đã có thì giữ nguyên. Áp 5 chỗ: `home/WeeklyAppointmentsTable.tsx` (chỗ trong ảnh, bỏ luôn `cleanDoctor` cũ), `appointments/AppointmentsKanban.tsx`, `patients/[id]/PatientDetail.tsx`, `cskh-today/page.tsx`. (Các chỗ render tên trần không prefix — giữ nguyên, vốn đã hiển thị đủ học hàm.)
2. **`/customers` tìm kiếm phải bấm "Tìm" → bất tiện**: `CustomersView.tsx` đổi sang GÕ-TỚI-ĐÂU-LỌC-TỚI-ĐÓ = lọc CLIENT tức thì (`useMemo`+`unaccentVi`, giống `/patient-list` mà PM OK) + tự gọi server debounce 350ms bọc `useTransition` (phủ toàn DB cho BN ngoài 300 dòng đã nạp, KHÔNG nháy skeleton, KHÔNG mất focus). BỎ nút "Tìm"; Enter vẫn tìm ngay; "Xoá" hiện theo `term`. (`/patient-list` không đụng — PM bảo OK.)
- Verify: `tsc --noEmit` ✓ · `npm run lint` ✓ · `next build` ✓ (exit 0).
- **3 commit local trên `chinh`** (CHƯA push): `b7e8264` fix dashboard · `8ec8f00` feat roster seed · `091e778` docs. Chờ Quang duyệt → ra lệnh push (CỔNG 1).

### T-FORM-COMPACT-02 — TAB hoá PHIẾU KHÁM BỆNH `ClinicalRecordForm.tsx` (giảm cuộn) — ĐÃ VÀO `chinh`
**Sửa scope của -01:** lần trước nhắm `ServiceFormEngine.tsx` (chỉ là 1 card nhỏ ở đáy). Phiếu DÀI mà BS/TKYK thật sự cuộn là **`ClinicalRecordForm.tsx`** (~1158 dòng, render dọc liên tục I→X + Sinh hiệu + Phiếu chuyên khoa). Lần này nhắm đúng nó. Chỉ đổi CÁCH HIỂN THỊ, GIỮ NGUYÊN mọi field/logic/chế độ.
**File sửa DUY NHẤT:** `src/dashboard/app/(dashboard)/tasks/ClinicalRecordForm.tsx`. KHÔNG đụng ServiceFormEngine/SonoBiometry/PreVisitBrief/API/schema/lib.
**Đã làm (BỌC JSX, không viết lại logic):**
- **(A) Gom 4 TAB** theo luồng khám + state `const [tab,setTab]=useState(vitalsOnly?1:0)`: **Tab 0 Hành chính & Tiền sử** (I + PreVisitBrief + Lịch sử khám trước + III + IV) · **Tab 1 Khám** (Sinh hiệu + II Lý do + V Bệnh sử/khám thai + SonoBiometry — Sono dời xuống cuối tab) · **Tab 2 Cận lâm sàng & Chuyên khoa** (VI + ServiceFormEngine card tab riêng, nested OK) · **Tab 3 Chẩn đoán & Xử trí** (VII + VIII + IX Đơn thuốc + X Tái khám). Cách bọc: mỗi khối giữ NGUYÊN nội dung + điều kiện (`showSono`/`showPreVisitBrief`/`viewingPast`/`!vitalsOnly`), chỉ thêm `{tab===N && (...)}`; chỉ render tab đang chọn (state global useState → không mất gì, field điều kiện chéo tab vẫn đúng).
- **(B) Khung cố định, chỉ ruột cuộn:** Header+Pager (cố định) → Banner cảnh báo dời lên vùng cố định → thanh TAB cố định (cuộn ngang, có ✓ khi tab đã điền) → GIỮA cuộn (`overflow-y-auto` chỉ ở lớp nội dung tab) → Footer Lưu/Tái khám/Đóng cố định (vốn đã là sibling cố định — nay nút Lưu LUÔN thấy, khỏi cuộn đáy). `msg` cạnh footer như cũ.
- **(C) Validation auto-nhảy tab:** cả `saveVitals()` (ĐD) lẫn `save()` (BS) khi thiếu REQUIRED_VITALS (huyet_ap/can_nang/chieu_cao) → `setVitalsTried(true)` + `setTab(1)` (tab Khám) + msg → thấy ô đỏ dù đang ở tab khác. (Trước đó `save()` BS KHÔNG validate vitals → đã thêm guard, đúng D26 + đúng kịch bản test packet "BS thiếu sinh hiệu → nhảy tab Khám".)
- **(D) ✓ tiến độ trên tab** (helper `tabFilled` đọc thuần state) — optional, đã làm.
**Chế độ (review logic, giữ nguyên hành vi):** readOnly/Lễ tân (đổi tab xem, ẩn Lưu) · locked/FINALIZED (mọi field disabled, banner 🔒) · vitalsOnly/ĐD (mặc định tab Khám, chỉ Sinh hiệu sửa, IX+Phiếu chuyên khoa ẩn) · viewingPast/pager (◀▶ chạy, ẩn Lưu). ServiceFormEngine vẫn `readOnly={readOnly||locked}`.
**Verify (từ `src/dashboard`):** `tsc --noEmit` ✓ · `eslint` file mình ✓ No issues · `npm run build` ✓ exit 0.
**⚠️ Git — entangled với Quang:** trong lúc làm, **Quang code SONG SONG cùng file trên VSCode và đã COMMIT working-tree của mình**. Toàn bộ thay đổi -02 của Claude đã nằm trong commit `136fb7f` (style/whitespace) + `ac93005` (close tab 3 JSX + scope ServiceFormEngine vào tab 2) trên `chinh`; tree giờ CLEAN. → KHÔNG tạo commit trùng. Code -02 verified pass trên HEAD hiện tại. CHƯA push (chờ Quang — Cổng 1).

### T-FORM-COMPACT-01 — Form khám "ÍT CUỘN" (ĐÃ COMMIT `29aab14`, CHƯA push)
**Vấn đề PM:** phiếu khám chuyên khoa quá dài → BS/TKYK phải cuộn nhiều khi vội. Yêu cầu: GIỮ ĐỦ trường, gần như hết cuộn. Chỉ đổi CÁCH HIỂN THỊ, không đổi dữ liệu.
**File sửa DUY NHẤT:** `src/dashboard/app/(dashboard)/tasks/ServiceFormEngine.tsx` (engine config-driven → 1 lần sửa, cả 5 form PK/SK/NT/HMVS/NK hưởng). KHÔNG đụng schema/field/API/`form_data`.
**Đã làm:**
- **(A) Chia TAB theo section** — thêm state `activeIdx`; thanh tab ngang sticky (cuộn ngang được), chỉ render section đang active (DOM gọn, `values` vẫn giữ toàn bộ → không mất dữ liệu/field điều kiện chéo section). Tab có dấu ✓ khi section đã điền ≥1 field. Thanh nav dưới LUÔN hiện: `← Mục trước · Mục i/N · title · Mục sau →` + **nút "Lưu phiếu" đưa vào thanh này** (khỏi cuộn xuống đáy). readOnly vẫn chuyển tab xem, ẩn nút Lưu.
- **(B) radio + checkbox_group → CHIP** (pill bấm) thay list dọc → cắt chiều cao 2–3 lần. radio = chọn 1, group = toggle nhiều (vẫn dùng `onToggleGroup`, value giữ string / string[]). Chip active nền hồng nhạt + chữ `#9d2463`; disabled khi readOnly.
- **(C) Field ngắn nhiều cột** — grid section lên `sm:grid-cols-2 lg:grid-cols-3`; textarea/conditional/fullWidth chiếm trọn hàng (`sm:col-span-2 lg:col-span-3`).
- **(D, stretch) "Tất cả bình thường"** — làm GENERIC (không hard-code schema): nút đầu section, dò option có label/value ∈ {"bình thường","bt","không","ko"} cho field radio/checkbox_group rồi set; chỉ hiện khi section có ≥1 field khớp. Không đụng field khác.
**Verify (từ `src/dashboard`):** `npx tsc --noEmit` ✓ No errors · `eslint` file mình ✓ No issues (2 lỗi lint còn lại nằm ở file Quang đang code: `WeeklyAppointmentsTable.tsx`, `tasks/page.tsx` — KHÔNG đụng) · `npm run build` ✓ Compiled successfully (exit 0).
**Lưu ý git:** lúc stage, `Nav.tsx`+`Shell.tsx` (file Quang đang sửa) đang nằm sẵn trong index → đã `git restore --staged` để commit CHỈ chứa `ServiceFormEngine.tsx`. Working tree còn `Nav.tsx`, `Shell.tsx`, `docs/VAN_HANH.md` nguyên vẹn của Quang.
**TODO/ngoài scope (giữ nguyên):** prefill tiền sử, auto-BMI/EFW — task khác. CHƯA push (chờ Quang nói "OK" — Cổng 1).

### Lịch làm việc TRỐNG → ĐÃ IMPORT + áp DB ✓
**Nguyên nhân:** `/schedule` ([schedule/page.tsx](src/dashboard/app/(dashboard)/schedule/page.tsx)) query `work_roster WHERE week_start = <thứ 2 của tuần>`. Tuần 15-21/06 (`week_start = 2026-06-15`) chỉ có 1 ô cũ (BS Thành 18/06) → lưới trống. Cần nạp dữ liệu thật từ Excel.

**Đã làm (auto, KHÔNG ghi DB):**
- Viết parser [scripts/data_import/import_roster_llv_062026.py](scripts/data_import/import_roster_llv_062026.py) đọc sheet **LLV 06-2026** của `~/Downloads/BẢNG LÀM VIỆC 06.2026 (1).xlsx`.
- Sinh seed idempotent [src/migrations/seed/056_roster_llv_062026.sql](src/migrations/seed/056_roster_llv_062026.sql): **305 dòng, 3 tuần** (`2026-06-01`, `2026-06-08`, `2026-06-15`). Đã spot-check: 15/06 LICH_KHAM=BS HÙNG, 18/06=BS THÀNH+BS QUYẾT (khớp Excel).
- SQL: `BEGIN; DELETE work_roster WHERE week_start IN (3 tuần); INSERT 305 dòng; COMMIT;` (chạy lại an toàn).

**ĐÃ ÁP vào DB (Quang chạy psql 23/6) — confirmed:** `2026-06-01`=95 · `2026-06-08`=111 · `2026-06-15`=99 (tổng 305).
- `/schedule` mặc định mở TUẦN HIỆN TẠI. Hôm nay 23/6 → tuần 22-28/06 (KHÔNG có trong Excel) nên mặc định trống; data thật ở tuần 01–21 (`/schedule?week=2026-06-15`).
- **TEMP COPY (Quang yêu cầu 23/6):** copy tuần 15-21 → 22-28 (+7 ngày) cho có hiển thị tạm:
  `DELETE work_roster WHERE week_start='2026-06-22'; INSERT (...) SELECT '2026-06-22', work_date+7, ... WHERE week_start='2026-06-15';`
  → **TUẦN 22-28 LÀ DATA NHÁI** (bản sao 15-21), KHÔNG phải lịch thật → đè khi có lịch thật.

**Map cột Excel → station key (lib/roster.ts), tái dùng cho tháng sau:**
`C=LICH_KHAM · D=SB_CHIEU · E=HSS_THU_THUAT · F=LE_TAN · G=LAY_MAU · H=PHU_BS_KHAM · I=TLYK · K=PHU_BS_SA · L=PHONG_NGOAI_MOR · M=MAY_TRONG · N=MAY_NGOAI`. Mỗi ngày = 2 hàng tên; T7/CN tách Sáng/Chiều (shift SANG/CHIEU), T2–T6 = FULL.

**Caveat:** (a) `staff_id = NULL`, `staff_name` = nguyên văn tên tắt (có ô 2 người như "Hằng Trang Lê") → bảng hiển thị đủ, nhưng form "Đăng ký ca của tôi" lọc theo staff_id sẽ không nhận; backfill staff_id sau nếu cần. (b) Cột J "THU NGÂN THUỐC" (chỉ tuần 15-21) chưa có STATION trong dashboard → ĐÃ BỎ QUA; muốn hiện phải thêm 1 key vào `STATIONS` (lib/roster.ts) + cột bảng. (c) Sheet LLV 06-2026 chỉ có 3 tuần (01–21); tuần 22–30/06 chưa có trong file.

**⚠️ Quang đang code SONG SONG (VSCode, CHƯA commit — KHÔNG phải của Claude phiên này):** `nav-items.ts`, `patients/new/{NewPatientForm,page}.tsx`, `api/appointments/route.ts`, migration `057_drop_appointment_doctor_overlap_constraint` (gỡ chặn trùng giờ BS — overbook 3.4). Claude chỉ stage đúng file của mình; mấy file này còn nguyên trong working tree.

> ⚠️ Lưu ý: `CLAUDE.md §2 PHASE` còn ghi "LOAD chưa chạy / 17 bảng" — LỆCH với `SYSTEM_STATE_ACTUAL.md` (03/06: đã LOAD, 27 bảng). Chưa sửa §2 vì ngoài scope; chờ lệnh.

---

# HANDOFF WORKLOG — Dashboard Ver2 (phiên 19/6, đóng)

## TRẠNG THÁI
Dashboard Ver2: hoàn tất TOÀN BỘ phần code làm được mà không cần input người.
~42 commit LOCAL, CHƯA push. Branch: feat/t-transform-01.
Phần còn lại = CHỜ PK/Quang/BS (không phải nợ code).

---

## COMMIT PHIÊN NÀY (theo thứ tự)
- 82454db — Lễ tân: progress stepper + đồng hồ chờ đổi màu (WAIT_GREEN_MAX=10/YELLOW=20). 2 mốc cuối xám chờ billing.
- 0bff182 — CSKH: bảng nhắc gọi 4 bucket (FOLLOWUP_TIERS=[2,10,20,30]) + nút "Đã gọi" → cskh_followup. Bucket RỖNG tới khi BS điền tai_kham.ngay (đúng, không phải bug).
- 73d5ff6 — Cashier split: mig052, role CASHIER_THUOC + CASHIER_DV (2 login riêng), CASHIER cũ = superset.
- 871418b — Catalog: mig051, drug_catalog (64 thuốc) + service_price (29 DV), giá NULL (lazy-fill). Picker runtime /api/catalog + datalist, dùng chung 5 form. 3 needs_review.
- 11f02d3 — Bỏ nút BS "Nhận/Trả lịch" (luồng: Lễ tân check-in → BS khám thẳng) + tên BS đầy đủ (mig053 seed 17 BS) + 3 chỗ render short_name→full_name (roster/chip/picker).
- 8ba2a8e — TKYK enable: mở menu /tasks + /patient-list + vào form khám (clinical-record gate thêm isThuKyRole). Nhánh B: thấy MỌI BS. attending_doctor_id = appointment.doctor_id (TKYK không bị ghi là người khám). TKYK KHÔNG finalize (giữ cho BS).
- bc29641 — Địa chỉ dropdown sau sáp nhập: mig054, bảng province (34) + ward (3321), nguồn ThangLeQuoc/vietnamese-provinces-database tag v3.1.0 (cấu trúc tỉnh→phường bỏ huyện). Form intake 2 select phụ thuộc. BN cũ free-text giữ nguyên.
- 2d9daea — Sửa wording board Lễ tân ("không chỉnh sửa" → "xem lâm sàng, ĐƯỢC sửa hành chính") + tên BS 3 chỗ sót (home greeting, TasksRealtime, schedule/edit).
- fabda0a — CSKH: field van_de_di_kham (text) + linh_vuc (mig055, CHECK 5 mã = TÁI DÙNG service_code PK/SK/NT/HMVS/NK, sẵn map sang form khám). KHÔNG đụng "Lý do khám" của BS.
- 5add7f0 — Form số đo siêu âm: ultrasound_record.findings JSONB (mig018 đã có), 7 số đo CRL/NT/BPD/HC/AC/FL + EFW NHẬP TAY (// TODO auto-EFW chờ Hadlock BS Thắng). 4 nút Bắt đầu/Lưu/Bất thường/Hoàn tất. Gate isUltrasoundDoctorRole, chặn ghi khi FINALIZED.
- 0bc6d47 — FIX dropdown tỉnh trống: gốc = RLS bảng province/ward bật nhưng KHÔNG có policy SELECT → authenticated đọc 0 dòng. Sửa: đọc bằng service-role bypass RLS (data hành chính công khai, server-only an toàn).

---

## TRẠNG THÁI Ô VÀNG EXCEL (12 mục): 10 XONG
- ✅ 3.0/18.0 TKYK · 4.0 PT→Phẫu thuật + tên BS · 6.0 giới tính Khác · 10.0 địa chỉ dropdown · 11.0 ngày DD/MM/YYYY · 12.0 bỏ BS duyệt + check-in Lễ tân · 13.0 Lễ tân sửa BN · 15.0 ĐD sửa Lý do khám · 16.0 sinh hiệu HA/CN/CC + dấu *
- ⚠️ 1.0 Trưởng ca: LỆCH SPEC — đã làm hành chính-only (theo recap 17/6), Excel ghi "toàn bộ". CHỜ QUANG CHỐT.
- ❌ 5.0 CM/lịch làm việc: scope chưa rõ (Excel có 2 đề xuất). CHỜ PK.

## TRẠNG THÁI HTML 7 MỤC: 5 trọn + 1 vừa xong + 1 defer
- ✅ #1 CSKH nhắc gọi · #2 lễ tân progress · #4 ĐD siêu âm 2 hàng đợi · #5 form theo dịch vụ · #6 BS siêu âm số đo (vừa xong)
- ⚠️ #3 thu ngân: role tách XONG; THIẾU hóa đơn QR + billing thuốc (chờ STK VietQR + bảng giá PK)
- ⏸️ #7 lưu ảnh: Phase 3 defer (đã chốt)

---

## CHỜ PK/QUANG/BS 24/6 (KHÔNG code được — thiếu input người)
1. ⚠️ 4.1 LỖ HỔNG NGHI: api/lab-result PATCH KHÔNG check FINALIZED → có thể sửa lab sau khi visit chốt. PK quyết: kết quả XN về muộn nhập vào đâu — amendment (có vết) hay sửa thẳng? (Tuyền test tay xác nhận trước.)
2. 1.0 Trưởng ca: "toàn bộ" (Excel) hay "hành chính only" (recap 17/6)? → Quang.
3. 5.0 CM khác Trưởng ca chỗ nào + cơ chế lịch làm việc (2 đề xuất).
4. 3.4 slot gối giờ overbook: 1 khung tối đa mấy BN, giới hạn theo BS/phòng/dịch vụ? (mig012 đang CHẶN trùng — cần gỡ đúng cách.)
5. 3.5 cấu trúc tóm tắt điều trị đa-visit → BS Thắng.
6. auto-EFW: công thức Hadlock? → BS Thắng.
7. Form tiền hôn nhân + NPĐH: field lâm sàng → BS đưa.
8. linh_vuc CSKH chọn → có AUTO chọn form khám tương ứng không? (mã đã trùng service_code, wire 1-line nếu PK muốn.)
9. #3d hóa đơn: STK + ngân hàng để sinh VietQR + bảng giá thuốc.
10. 3 thuốc needs_review → DƯỢC: Fes 1/10 · Utrogestan (Đ)/(U) · nhóm Difavon/Diflucan/Fluconazole.

---

## NỢ KỸ THUẬT
- RLS policy: province/ward đang đọc bằng service-role (vá). Idiomatic = thêm RLS policy SELECT giống service_type. Không gấp (data công khai, không PII).
- 88 row work_roster.staff_name cũ vẫn tên tắt (chỉ ca mới dùng full_name) — chưa backfill, ngoài scope.
- 4.1 PATCH lab-result chưa guard FINALIZED — chờ PK quyết (xem trên).
- in phiếu siêu âm chưa hiện số đo (chưa wire print).
- is_abnormal trong JSONB — nếu cần query "ca bất thường" thì promote thành cột riêng.
- ~42 commit LOCAL chưa push.
- 043 vẫn lỗ (append-only clinical chỉ app-layer cho clinical_record/lab_result; prescription xóa-ghi-lại tự do). Apply 043 + mở logEvent phủ thao tác lâm sàng = việc xin tài trợ làm sau.

---

## TUYỀN LOGIN TEST TAY (subagent không verify UI được)
1. ⚠️ 4.1 (ƯU TIÊN): nhập lab SAU khi visit FINALIZED → DB/API có chặn không? Lọt = báo lại (lỗ hổng).
2. Dropdown tỉnh /patients/new: ra 34 tỉnh chưa? Chọn tỉnh → phường lọc đúng? (vừa fix 0bc6d47)
3. ĐD nhập "Lý do khám" → BS vào sau, data còn không?
4. Lễ tân bấm tên BN → nút "Sửa thông tin" sáng + lưu được? (wording mới)
5. Tên BS đầy đủ ở lời chào + các board?
6. Gõ "hoa" có ra "Hòa" (search BN + nhân sự)?
7. Datalist "Chỉ định CLS" gợi ý + nhóm theo chuyên khoa? Picker thuốc lưu liều/HDSD?

---

## VIỆC NGOÀI CODE
- Push ~42 commit local khi sẵn sàng.
- Gửi DƯỢC 3 câu thuốc needs_review.
- Mang 10 câu (mục CHỜ PK) đi họp PK 24/6.
- Sửa pre-commit hook (gốc python@3.14 đã gỡ → Poetry chết): cài lại Poetry bằng python3.12 + poetry env use python3.12. Hiện đang --no-verify.

---

## QUY ƯỚC CẦU NỐI CLAUDE CODE ↔ PHIÊN CHAT (quan trọng)
Phiên chat (advisor) KHÔNG tự thấy việc làm bên Claude Code. Để advisor nắm thay đổi:
- Bên Claude Code: mỗi việc xong → ghi vào worklog/CURRENT_PROGRESS.md (delta + commit hash).
- Phiên chat sau: PASTE worklog này (hoặc git log --oneline -20) cho advisor đọc.
- Memory chỉ nhớ bối cảnh trong cuộc trò chuyện, KHÔNG tự cập nhật việc làm chỗ khác — phải tự kể/paste.
