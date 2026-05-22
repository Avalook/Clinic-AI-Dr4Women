# DATA GAP REPORT — 16 CSV ↔ Schema v6

> Generated: 2026-05-22 | HEAD: 59fd44e (worklog commit on `main`)
> Source profile: `data_audit/PROFILE_REPORT.md` (P-IMPORT-0, commit 813a023)
> In-scope tables: **patient · appointment · visit · clinic_location**
> NOT in this report: billing, drug/prescription, supply (deferred phase)

---

## TL;DR (3 dòng cho PM đọc)

1. **CCCD bằng 0**: 0/16 file có `national_id_number` → MVP phải bỏ NOT-NULL kỳ vọng (canon đã NULL-able từ đầu) và dùng **MPI 3-field** (name + DOB + phone) thay vì 4-field.
2. **3 NOT-NULL fields ở `patient` đều xử lý được**: `patient_code` lấy từ `*ID` Notion (`KHACH-xxxxx`, 0% null), `full_name` từ `//họ tên (neat)` (0.3% null), `location_id` phải **seed master clinic_location TRƯỚC** rồi gán hard-coded "Kim Ngưu" cho mọi row cũ.
3. **Master file đếm ~6,090 BN** (file hành chính `_all`), MPI 3-field coverage ~94% → ~370 row cần REVIEW_QUEUE; CCCD 100% BLOCK→NULL_OK; `appointment.location_id` BLOCK chờ master seed.

---

## 1. Schema fields — NOT NULL requirements

### `patient` (mig 004)
| Field | Type | NOT NULL? | Default | Ghi chú |
|---|---|---|---|---|
| `clinic_patient_id` | UUID | PK | `gen_random_uuid()` | Auto |
| `patient_code` | TEXT | **NOT NULL** + UNIQUE | — | Import phải set |
| `national_id_number` | TEXT | nullable | — | partial UNIQUE index khi NOT NULL |
| `full_name` | TEXT | **NOT NULL** | — | Import phải set |
| `date_of_birth` | DATE | nullable | — | |
| `phone_primary` | TEXT | nullable | — | indexed |
| `phone_secondary` | TEXT | nullable | — | |
| `location_id` | UUID | **NOT NULL** + FK | — | FK `clinic_location(id)` |
| `is_active` | BOOLEAN | nullable | `TRUE` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | nullable | `NOW()` | |

**Hard NOT-NULL ở insert**: `patient_code`, `full_name`, `location_id`.

### `clinic_location` (mig 001) — MASTER, seed trước import
| Field | NOT NULL? | Ghi chú |
|---|---|---|
| `id` | PK auto | |
| `code` | **NOT NULL** + UNIQUE | "KN", "HN"... |
| `name` | **NOT NULL** | "Kim Ngưu", "Hào Nam"... |
| `address`, `is_active`, `created_at` | nullable | |

### `appointment` (mig 011)
| Field | NOT NULL? | Ghi chú |
|---|---|---|
| `id` | PK auto | |
| `clinic_patient_id` | **NOT NULL** FK → patient | |
| `doctor_id` | nullable FK → staff | |
| `work_session_id` | nullable FK | |
| `location_id` | **NOT NULL** FK → clinic_location | |
| `service_type_id` | **NOT NULL** FK → service_type | service_type cũng phải seed trước |
| `booking_channel` | nullable | TEXT free-form |
| `slot_start`, `slot_end` | **NOT NULL** | CHECK `slot_end > slot_start` |
| `assigned_station`, `queue_number` | nullable | |
| `is_priority_slot`, `is_walkin` | **NOT NULL** (default FALSE) | |
| `status` | **NOT NULL** (default 'SCHEDULED') | CHECK `IN ('SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED')` |
| `confirmed_at`, `cancelled_at`, `cancellation_reason` | nullable | |

**Hard NOT-NULL ở insert**: `clinic_patient_id`, `location_id`, `service_type_id`, `slot_start`, `slot_end`, `status`.

### `visit` (mig 017)
| Field | NOT NULL? | Ghi chú |
|---|---|---|
| `visit_id` | PK auto | |
| `clinic_patient_id` | **NOT NULL** FK | |
| `appointment_id` | nullable FK | walk-in không có |
| `work_session_id`, `attending_doctor_id`, `location_id`, `service_type_id` | nullable FK | location/service denormalized |
| `status` | **NOT NULL** (default 'OPEN') | CHECK `IN ('OPEN','IN_PROGRESS','FINALIZED','AMENDED')` |
| `finalized_at`, `finalized_by`, `checked_in_at`, `checked_in_by` | nullable | |
| `created_at`, `updated_at` | NOT NULL (default NOW) | |

**Hard NOT-NULL ở insert**: `clinic_patient_id` (status có default).

**Visit nguồn dữ liệu**: KHÔNG có CSV "visit" trực tiếp — visit phải derive từ appointment có `Tình trạng khách đến = "Đã đến"` hoặc tương đương + Dịch vụ đã `Done`. Báo cáo này không scope ETL chi tiết visit.

---

## 2. CSV coverage per field (gap matrix, in-scope = patient + appointment)

Master file dùng cho `patient`: **`File khách hàng (hành chính) ..._all.csv`** (6090 rows — bản lịch sử đầy đủ; bản primary 601 row chỉ là snapshot Notion gần đây của cùng dataset).

### `patient` field coverage

| Schema field | NOT NULL? | Source column (hành chính `_all`) | Coverage % | Mapping confidence | Recommendation |
|---|---|---|---|---|---|
| `patient_code` | ✅ | `*ID` (`KHACH-xxxxx`) | **100%** | HIGH | Import as-is |
| `full_name` | ✅ | `//họ tên (neat)` | **99.7%** | HIGH | Import; 18 rows null → REVIEW_QUEUE |
| `location_id` | ✅ FK | KHÔNG có cột source | **0%** | UNMAPPED | **BLOCK** — phải hỏi clinic + hard-default |
| `national_id_number` | nullable | KHÔNG có cột | **0%** | UNMAPPED | NULL_OK (canon đã NULL) |
| `date_of_birth` | nullable | `Ngày sinh` (`07/09/1988` etc) | **95.1%** | HIGH | NULL_OK; 297 rows null |
| `phone_primary` | nullable | `//sdt (neat)` (masked `******1997`) | **99.1%** | HIGH | NULL_OK; raw value bị mask trong profile, cần kiểm tra original CSV trước import (audit này không decrypt) |
| `phone_secondary` | nullable | `Người nhà` (95.5% null) hoặc parse từ `📌GHI CHÚ VĨNH VIỄN` | **~4.5%** | LOW | NULL_OK |
| `is_active` | nullable (default TRUE) | KHÔNG có flag rõ | — | — | NULL_OK; use default |

### `appointment` field coverage

Source: **`LỊCH HẸN ...csv`** / `_all.csv` (10,032 rows).

| Schema field | NOT NULL? | Source column | Coverage % | Mapping confidence | Recommendation |
|---|---|---|---|---|---|
| `clinic_patient_id` | ✅ FK | `🔑File hành chính` (Notion link) | **99.7%** | MEDIUM | Cần resolve Notion link → KHACH-xxxxx → UUID. 31 row null → REVIEW_QUEUE |
| `location_id` | ✅ FK | `Phòng khám` ("Kim Ngưu"...) | **94.8%** | MEDIUM | Cần map "Kim Ngưu"→KN; 522 rows null → BLOCK hoặc default |
| `service_type_id` | ✅ FK | `Loại dịch vụ khám` ("Phụ khoa"/"Sản 3"...) | **96.5%** | MEDIUM | Cần seed service_type catalog từ distinct values (14 unique). 352 null → REVIEW_QUEUE |
| `slot_start` | ✅ | `Ngày giờ hẹn` (`14/11/2025 20:30 (GMT+7)`) | **98.4%** | HIGH | Parse VN format + strip "(GMT+7)" |
| `slot_end` | ✅ | KHÔNG có cột end-time | **0%** | UNMAPPED | **BLOCK** — phải compute (slot_start + service duration default? hoặc bỏ NOT-NULL?) |
| `status` | ✅ (default) | `Tình trạng khách đến` ("Đã đến"...) | **98.4%** | MEDIUM | Map values to canon enum (`Đã đến` → CHECKED_IN/COMPLETED?) → REVIEW_QUEUE mapping rule |
| `doctor_id` | nullable | `Bác sĩ` ("BS Thành"...) | **92.3%** | MEDIUM | Cần map "BS Thành" → staff.id; staff seed trước |
| `booking_channel` | nullable | `Nguồn khách` (`FB 1`...) | **30.9%** trên master | LOW | NULL_OK |
| `queue_number` | nullable | `Số thứ tự` (`31`, `36`...) | **67.5%** | HIGH | NULL_OK |
| `is_walkin` | NOT NULL (default FALSE) | KHÔNG có flag | — | — | NULL_OK default; có thể infer từ `Tình trạng khách đến` nếu cần |
| `is_priority_slot` | NOT NULL (default FALSE) | `Tag giờ hẹn` (chứa `[C🌑]`)? | LOW signal | LOW | NULL_OK |
| `confirmed_at`, `cancelled_at` | nullable | — | — | — | NULL_OK |

---

## 3. Dedup estimate

Population estimate dựa trên master file `File khách hàng (hành chính)_all.csv` (6090 rows — bản đầy đủ với ID `KHACH-5192..KHACH-10000+`):

| Metric | Số liệu | Diễn giải |
|---|---:|---|
| Tổng row master | **6090** | Số "lần ghi" trong Notion master. Một số có thể là duplicate. |
| `*ID` unique | **6090** | ID nội bộ Notion unique 100% — KHÔNG dedup được bằng ID này |
| `//sdt (neat)` unique values | **5708** | Trong số ~6035 row có phone. Chênh ~327 row → ≥163 nhóm trùng phone trong master alone |
| `//họ tên (neat)` unique | **4230** | 4230 tên unique → nhiều BN cùng tên (chính xác — VN có nhiều BN cùng tên) |
| Cross-file dup phone (16 file) | **826 groups / 1744 rows** | Từ P-IMPORT-0 — phần lớn là cross-file (1 BN xuất hiện ở master + Lịch hẹn + Dịch vụ...) |
| Cross-file dup (name+DOB) | **599 groups / 1208 rows** | |

### MPI 3-field readiness (name + DOB + phone, vì CCCD = 0%)

Giả định độc lập (conservative lower bound — overestimate gaps):

| MPI completeness | Coverage | Row count (trên 6090) |
|---|---:|---:|
| Có đủ 3 field (name + DOB + phone) | **≥ 93.9%** (≤ 0.3% + 4.9% + 0.9% = 6.1% tổng null) | **~5,720 rows** |
| Thiếu 1 field | hầu hết là DOB null (4.9%) | **~300 rows** |
| Thiếu ≥2 field | nhỏ | **~50–70 rows** |

> **Cảnh báo độ chính xác**: ước lượng trên giả định null events độc lập. Joint stats sẽ cần re-run profile.py với cross-column null analysis — out-of-scope cho task này. Số thực tế có thể 92–96%, không phải con số tuyệt đối.

### Number of unique BN (estimate, không tự quyết)

- **Lower bound**: 4,230 (số tên unique) — sai vì nhiều BN cùng tên.
- **Realistic**: ~5,700–5,900 (số phone unique 5,708 + một số BN không phone) — đủ tin cậy cho phase 1.
- **Upper bound**: 6,090 (mỗi row 1 BN) — sai vì đã có 327+ row trùng phone.

Đề xuất số làm việc: **~5,800 BN** sau dedup MPI.

---

## 4. Per-file header mapping (16 file)

> Pairs `name.csv` + `name_all.csv` = same Notion DB. Primary version = snapshot UI hiện thời. `_all` = include subpages, **đầy đủ historical** — dùng cho import.

### A. `File khách hàng (hành chính)` — **master patient** (primary 601 / `_all` 6090)
| Notion column | Schema target | Confidence |
|---|---|---|
| `*ID` (`KHACH-xxxxx`) | `patient.patient_code` | HIGH |
| `//họ tên (neat)` | `patient.full_name` | HIGH |
| `//sdt (neat)` | `patient.phone_primary` | HIGH (masked in profile) |
| `Ngày sinh` | `patient.date_of_birth` | HIGH (parse `dd/mm/yyyy`) |
| `Giới tính` | — (schema chưa có gender column ở patient) | UNMAPPED (gap canon) |
| `Địa chỉ` | — (schema không có patient.address) | UNMAPPED (gap canon) |
| `Email` | — (100% null) | UNMAPPED |
| `Phân loại khách`, `Ưu tiên` | — | UNMAPPED |
| `Nguồn khách` | `appointment.booking_channel` (per-appt) hoặc patient tag | LOW |
| `🔑 File lâm sàng` | join link → File lâm sàng | metadata |
| `Tóm tắt thông tin` | — (free-form clinical summary) | UNMAPPED |
| `📌GHI CHÚ VĨNH VIỄN` | — (sticky notes — có thể chứa SDT khác/người nhà) | LOW |

### B. `File bệnh nhân (lâm sàng)` — clinical encounter view (6182 row mỗi version)
| Notion column | Schema target | Confidence |
|---|---|---|
| `*ID` (`LAMSANG-xxxx`) | KHÔNG có schema slot riêng | UNMAPPED (encounter ID) |
| `Họ tên` | `patient.full_name` (cross-ref) | HIGH |
| `Tuổi thai` (`27.6 w`) | `pregnancy.gestational_age_at_registration` (per-pregnancy) | MEDIUM |
| `Dự kiến sinh` (`January 24, 2026`) | `pregnancy.edd_date` | HIGH |
| `Loại dịch vụ khám` (`Sản 3`, `Phụ khoa`...) | `service_type` per-encounter | MEDIUM |
| `File hành chính` | FK link → patient | HIGH |
| `Tóm tắt thông tin` | free-form clinical summary | UNMAPPED (visit-level) |
| `Link drive` | external storage ref | UNMAPPED (out of D3 scope) |

### C. `LỊCH HẸN` — appointment (10,032 × 2)
| Notion column | Schema target | Confidence |
|---|---|---|
| `ID` (`BOOK-1674`) | `appointment.id` external ref | HIGH (cần store as `external_ref` nếu cần — schema chưa có field này) |
| `🔑File hành chính` | `appointment.clinic_patient_id` | MEDIUM (Notion link resolve) |
| `Ngày giờ hẹn` | `appointment.slot_start` | HIGH (parse `dd/mm/yyyy HH:MM (GMT+7)`) |
| `Phòng khám` (`Kim Ngưu`) | `appointment.location_id` | MEDIUM (cần map name → location_id) |
| `Loại dịch vụ khám` | `appointment.service_type_id` | MEDIUM (cần seed service_type) |
| `Bác sĩ` (`BS Thành`) | `appointment.doctor_id` | MEDIUM (cần map name → staff.id) |
| `Tình trạng khách đến` (`Đã đến`, 4 distinct) | `appointment.status` | MEDIUM (cần mapping rule) |
| `Số thứ tự` (`31`) | `appointment.queue_number` | HIGH |
| `Check in` (100% null) | `appointment.confirmed_at` hoặc dropped | NULL_OK |
| `Tóm tắt bệnh nhân` | free-form (chứa DOB + addr) | UNMAPPED |
| `Ghi chú` | `appointment.cancellation_reason` (nếu cancel) hoặc free-form | LOW |
| **`slot_end`** | KHÔNG có | **UNMAPPED — BLOCK** |
| `is_walkin` | infer từ `Tình trạng khách đến` / `Phân loại` | LOW |
| `is_priority_slot` | có thể infer từ `Tag giờ hẹn` | LOW |
| `booking_channel` | KHÔNG có column riêng (master file có `Nguồn khách`) | NULL_OK |

### D. `CSKH Action` — task log (31,179 × 2)
Source-of-truth cho **task_manager** (mig016), KHÔNG phải appointment/visit. Out-of-scope T-AUDIT-01. Field signal cao: `Step` (#request), `Phân loại` (Đặt hẹn...), `Tình trạng`, `Deadline`, `Created by`, `Last edited time`, `Mô tả chi tiết`. Note: 25 distinct `Tình trạng` values — phong phú, cần mapping rule chi tiết khi import sau.

### E. `Dịch vụ` — services performed (15,075 × 2)
Source cho **lab_result** (xét nghiệm) hoặc **ultrasound_record** (SA) tùy `Tên dịch vụ`. Out-of-scope T-AUDIT-01 (chỉ patient + appt + visit). Field signal: `*ID` (`SERVICE-xxxxx`), `Phiếu khám` (FK ngược về visit?), `Tên dịch vụ` (42 distinct), `//Người làm` (BS), `Tình trạng`, `Kết quả`, `//Giờ bắt đầu`, `//Giờ kết thúc`.

### F. `Kê thuốc` (15,415 × 2 — và lại nhân đôi vì có `Private & Shared 6/`)
Drug/prescription — out-of-scope theo CONTEXT packet. Bỏ qua audit.

### G. `Xét nghiệm` (primary 64 + `_all` 5033)
Lab results — primary có 64 row chỉ là snapshot recent; `_all` 5033 row là historical. Source cho `lab_result` (mig015). Out-of-scope cho task này nhưng đáng note: `Kết quả AI` đã có pre-classified output → có thể bypass triage AI ở import?

---

## 5. Recommended actions trước khi import (BLOCK / REVIEW_QUEUE / NULL_OK)

### 🚫 BLOCK — phải resolve trước khi import row
| Item | Lý do | Đề xuất xử lý (chờ Quang quyết) |
|---|---|---|
| `patient.location_id` không có source | NOT NULL FK, master file không có column | Seed `clinic_location` trước, hard-default `location_id = clinic_location WHERE code = 'KN'` cho mọi BN cũ (giả định toàn bộ data lịch sử = Kim Ngưu) |
| `appointment.location_id` 5.2% null | NOT NULL FK | Same as above + REVIEW_QUEUE cho 522 row null trong `Phòng khám` |
| `appointment.slot_end` KHÔNG có source | NOT NULL | (a) Bỏ NOT-NULL trên `slot_end` (canon change — đề xuất ngoài file này), (b) Compute `slot_end = slot_start + service_type.default_duration`, (c) Set hard 30-min default |
| `appointment.service_type_id` 3.5% null | NOT NULL FK | Seed `service_type` từ 14 distinct values trong `Loại dịch vụ khám` trước import |
| `staff` (BS) chưa seed | `appointment.doctor_id` MEDIUM mapping | Seed staff trước (~8 BS distinct trong `Bác sĩ`) |

### ⚠️ REVIEW_QUEUE — human reviewer confirm dòng-by-dòng
| Item | Estimated rows | Lý do |
|---|---:|---|
| Patient master rows thiếu ≥1 MPI field | **~300–370** | DOB/phone null làm MPI 3-field không match được |
| 826 phone duplicate groups (1744 rows) | **1744** | Có thể là cùng BN (cần merge) hoặc trùng phone (chồng/con) |
| 599 (name+DOB) duplicate groups (1208 rows) | **1208** | Trùng tên+DOB nhưng có thể khác phone |
| `appointment.clinic_patient_id` (Notion link) resolve fail | **~30** | 0.3% null trong `🔑File hành chính` |
| `appointment.status` mapping VN→canon enum | toàn bộ | Phải define rule: "Đã đến"→? "Hủy"→CANCELLED... (4 distinct values nhưng `Tình trạng` đa dạng) |
| `appointment.service_type_id` mapping | ~352 null + 14 distinct values cần seed | |

### ✅ NULL_OK — nới NOT-NULL/skip, không block import
| Item | Lý do |
|---|---|
| `patient.national_id_number` | Canon đã nullable. 0/16 file có → toàn bộ NULL ở import phase 1. |
| `patient.date_of_birth` | Canon nullable. 4.9% null OK. |
| `patient.phone_secondary` | Canon nullable. ~95% null OK. |
| `patient.is_active` | Default TRUE. |
| `appointment.booking_channel` | Free-form, nullable. |
| `appointment.queue_number` | Free-form, nullable. |
| `appointment.is_walkin`, `is_priority_slot` | Default FALSE. |

---

## 6. Open questions (KHÔNG tự quyết — chờ Quang/clinic)

1. **`appointment.slot_end` không có source — chọn approach nào?**
   (a) Patch canon: `slot_end` nullable + CHECK skip khi NULL; (b) compute từ `service_type.default_duration_min` (mới); (c) hard-default `slot_start + 30 min`. → Cần Quang/BS quyết.

2. **`clinic_location` seed**: Data chỉ thấy `Kim Ngưu` (94.8% trong appointment.Phòng khám) và 5.2% null + 2 distinct giá trị khác (chưa rõ tên). Anh có **danh sách chính thức tất cả branches** (code + name) để seed master?

3. **MPI dedup policy**: 826 phone groups (1744 row) trùng cross-file — có phải case "1 SĐT cho cả gia đình" (chồng/con dùng chung phone mẹ)? Nếu CÓ thì MPI **không được merge** chỉ vì phone trùng → cần thêm rule (name+DOB+phone tất cả phải khớp).

4. **`appointment.status` mapping VN→canon enum**: Mapping cuối cùng từ Notion VN sang `('SCHEDULED','CONFIRMED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED')` cần BS/clinic confirm. Ví dụ:
   - `Đã đến` → `CHECKED_IN` hay `COMPLETED`?
   - `Hủy` (nếu có) → `CANCELLED`?
   - Row không có giá trị (1.6% null) → `SCHEDULED` default?

5. **Schema gaps đã phát hiện (decisions ngoài tài liệu này)**:
   - `patient` thiếu cột `gender` nhưng data có `Giới tính` (0% null primary, 50% null `_all`)
   - `patient` thiếu cột `address` nhưng data có `Địa chỉ` (6.5% null primary)
   → Đây là canon-level questions, KHÔNG suggest schema change trong report này. Quang quyết có cần D061/D062 mới hay không.

6. **`Người nhà` parsing**: cột này chứa "Tên 0SDT" theo cùng pattern → có thể là **emergency contact** hoặc **co-patient**. Schema chưa có table cho emergency_contact (D1 Patient ID 3-layer canon có đề cập `PatientContactChannel`). Có phải import vào đó hay drop?

7. **`*ID` (KHACH-xxxxx) làm patient_code**: số nhảy lên 10,601 trong primary nhưng `_all` bắt đầu từ 5,192 → tức là **clinic đã có ID gap** (cũ + mới đan xen). Có cần renumber sang format canon `BN-YYYY-XXXXXX` không, hay giữ KHACH-xxxxx?

---

### Generated artifacts

- This file: `_audit/DATA_GAP_REPORT.md` (current).
- Source profile: `data_audit/PROFILE_REPORT.md` (gitignored — chứa data BN masked).
- Profiler script: `scripts/data_audit/profile.py` (tracked).

### NOT done in this task (deferred)

- ETL implementation (BLOCK on Open questions 1–4).
- Per-row joint null analysis (re-run profiler with cross-column stats).
- Lab/drug/supply CSV mapping (out-of-scope this packet).
- Staff seed catalog (need staff list from clinic).
- service_type seed catalog (14 distinct values in `Loại dịch vụ khám`, but Dịch vụ has 42 — need clinical taxonomy).
