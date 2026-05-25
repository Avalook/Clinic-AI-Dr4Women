# SYSTEM_STATE_ACTUAL — Ảnh chụp hiện trạng THẬT

> Mục đích: đồng bộ với AI Planner. **Mọi số liệu đếm/đọc THẬT từ code + DB** (read-only),
> KHÔNG chép từ doc canon (doc đã lệch nhiều lần).
> Khảo sát: 2026-05-25 · Phương pháp: đọc `src/migrations/*.sql`, `src/clinicai/`, `SELECT count(*)` trên Supabase (read-only).

---

## STEP 0 — Git state

| | |
|---|---|
| Branch | `feat/t-transform-01` |
| Last commit | `ef538d5` — feat(migration): T-TRANSFORM-01 Notion CSV → staged files (no DB write) |
| Trạng thái | **DIRTY** — 2 file modified (`context/CURRENT_PROGRESS.md`, `worklog/CURRENT_PROGRESS.md`) + 1 untracked (`.ai/worklog/20260522.md`) |
| Nhánh đã push? | CHƯA (commit ef538d5 còn local) |

---

## STEP 1 — Database THẬT

### 1.1 Bảng tồn tại (đọc từ 20 migrations + xác nhận trên Supabase)

- **18 bảng domain** + `schema_migrations` = **19 BASE TABLE** trong schema `public`.
- **1 VIEW**: `patient_summary` (KHÔNG phải materialized table — Q-19 chốt phương án on-demand view).
- `schema_migrations` = **20 rows** → cả 20 migration đã apply. Không có bảng nào bị DROP/RENAME.

**→ 17/35 bảng canon** đã hiện thực (+ `mpi_merge_queue` ngoài canon + `patient_summary` dạng view).

### 1.2 Map theo 9 domain

| Domain | Canon | Có (table) | Thiếu | Phase phần thiếu |
|---|---|---|---|---|
| D1 Master Data | 3 | `clinic_location`, `service_type` | **BookingChannel** | P1 ⚠️ |
| D2 Patient | 5 | `patient`, `patient_medical_profile`, `pregnancy` | **PatientContactChannel**, **PatientNextOfKin** | P1 ⚠️ |
| D3 Clinical | 5 | `visit`, `clinical_record`, `visit_amendment`, `ultrasound_record` | **Prescription** | P2 |
| D4 Staff & Sched | 5 | `staff`, `staff_capability`, `work_session`, `work_session_staff`, `appointment` | — | ✅ 5/5 |
| D5 Lab | 3 | `lab_result` | **LabPartner**, **LabOrder** | P2 |
| D6 Task | 2 | `staff_task` (= Task, đổi tên) | **TaskEvent** | P2 |
| D7 Finance | 2 | — | **Invoice**, **InvoiceLineItem** | P2 |
| D8 Inventory | 6 | — | Drug, DrugBatch, DrugInvTxn, Supply, ServiceSupplyMapping, SupplyInvTxn | P3 |
| D9 Infra | 4 | `event_log` | **KBPage**, **KBChunk**, **KBPolicyRule** | P2 |
| **Tổng** | **35** | **17 tables** | **18 thiếu** | 3×P1 + 9×P2 + 6×P3 |

### 1.3 Bảng/đối tượng NGOÀI 35 canon

- `mpi_merge_queue` — Human Review Queue cho MPI dedup (canon §3.2 mô tả logic, không liệt kê bảng).
- `patient_summary` — VIEW (không phải table); Q-19 hiện thực theo on-demand.

### 1.4 Row counts THẬT (SELECT count, read-only — không in PII)

| Bảng | Count | Phân loại |
|---|---|---|
| `schema_migrations` | 20 | meta (cả 20 migration applied) |
| `clinic_location` | 2 | **seed** (KN, HN) ✓ |
| `service_type` | **1** | **seed THIẾU** — canon expект 15 rows; chỉ có 1 ⚠️ |
| `patient` | **30** | **demo/test** — KHÔNG phải transform (5728) |
| `staff` | **0** | seed `004_staff.sql` (29 rows) **CHƯA apply** ⚠️ |
| `appointment`, `visit`, `clinical_record`, `visit_amendment`, `ultrasound_record`, `lab_result`, `staff_task`, `pregnancy`, `patient_medical_profile`, `work_session`, `work_session_staff`, `staff_capability`, `event_log`, `mpi_merge_queue` | **0** | rỗng |

### 1.5 TRANSFORM đã LOAD vào DB chưa? → **CHƯA**

- T-TRANSFORM-01 (NHỊP 1) xuất **5728 patient** ra file staged (`scripts/data_migration/output/`, gitignore).
- DB chỉ có **30 patient** → là data demo/test, **không phải** data transform.
- **Kết luận: NHỊP 2 LOAD chưa chạy.** DB chưa có data BN thật.

---

## STEP 2 — Nợ kỹ thuật đã biết

### 2.1 Ba nợ Phase-1 (entity bị ép phẳng thành cột TEXT)

| Entity canon | Hiện trạng thật trong migration | Mức | Ảnh hưởng |
|---|---|---|---|
| **PatientContactChannel** | `patient.phone_primary` + `phone_secondary` (2 cột TEXT) | **Cao** | KHÔNG có chỗ lưu `zalo_user_id`/FB PSID/email → chặn Zalo routing (P12) + MPI dedup khuyết input `zalo_user_id` (+0.4) + mất data Zalo từ bảng CSKH (3393 dòng) |
| **BookingChannel** | `appointment.booking_channel TEXT` — không FK, không CHECK enum | Trung bình | Master-data drift ("Zalo"/"zalo"/"fb"); 9-row seed canon không có chỗ dùng |
| **PatientNextOfKin** | Không tồn tại (không cột người thân nào trong `patient`) | Thấp | Chưa lưu được người thân; nguồn Notion hầu như không có data này → defer được |

### 2.2 Prescription chưa có bảng đích

- D3 thiếu bảng `prescription` → file transform rx (**15319 dòng**) đang **PARKED** (no_target_table).
- **Phải tạo migration `prescription` TRƯỚC khi LOAD data thuốc.**

### 2.3 Các lệch doc-vs-thực-tế khác

- **`service_type` seed thiếu**: canon §2/§14 nói seed 15 rows + aliases; DB chỉ có 1 row. Seed file `002_service_type.sql`/`003_booking_channel.sql` **không tồn tại** trong `src/migrations/seed/` (chỉ có 001 + 004).
- **`staff` seed chưa apply**: file `004_staff.sql` (29 rows) tồn tại nhưng `staff` count = 0.
- **`patient.phone_primary` nullable** trong khi canon §3.1 ghi `Patient.phone NOT NULL` — lệch CÓ CHỦ ĐÍCH (hợp với rổ 🟡 skeleton), không tính lỗi.
- **3 lệch schema cho LOAD** (từ CURRENT_PROGRESS): clinical_record link qua `visit_id` (phải tạo visit trước), `lab_result` dùng cột `triage_group='PENDING'` (không phải `result_classification`).

---

## STEP 3 — Code đã build

### 3.1 Sub-graphs (`src/clinicai/graphs/` + orchestrator wiring)

| Sub-graph | Module thật? | Wired vào orchestrator | Trạng thái |
|---|---|---|---|
| **scheduling** | ✅ `graphs/scheduling/` (graph 86 + nodes 238 dòng + parsers + session_mapper) | real khi `pool` present, else stub | **DONE** (có fallback stub) |
| **lab_triage** | ✅ `graphs/lab_triage/` (graph 107 + nodes 347 dòng) | real-wrapper khi pool present | **DONE** (lưu ý: CURRENT_PROGRESS cũ ghi "P9.4 chưa code" — doc lệch, code ĐÃ có) |
| **task_manager** | ✅ `graphs/task_manager/` (graph 52 + nodes 187 dòng) | real-wrapper khi pool present | **DONE** |
| **pre_visit_brief** | ✅ `graphs/pre_visit_brief/` (graph 50 + nodes 106 dòng) | trong orchestrator vẫn hardwire **STUB**; expose qua API `/brief` | **DONE standalone**, chưa nối orchestrator |
| **communication** | ❌ chỉ có `communication_stub_node` | **STUB** | **CHƯA build** |

- Orchestrator route 5 intent: scheduling / lab / communication / task / previsit (+ general→respond).
- **4 module sub-graph thật + 1 stub-only (communication).**
- Services thật: `mpi_service`, `patient_service`, `patient_context_service`, `scheduling_service`, `staff_service`, `event_service`. Golden record engine: `golden_record/engine.py`.
- API routers: `brief`, `lab`, `orchestrator`, `scheduling`, `staff`, `tools`.

### 3.2 Test

- **71 file test**, **412 test function**, **12 skip marker**.
- Kết quả pass gần nhất (ghi nhận từ worklog, chưa chạy lại full ở phiên này): T-TRANSFORM-01 **20/20 pass** (ruff + mypy strict), safety-gate 017 **5/5 pass** (chặn thật).

### 3.3 Voice-to-EMR → **CHƯA CÓ NHẬN GIỌNG NÓI**

- **0 file Python** match `whisper|PhoWhisper|speech|transcribe|stt`.
- DB chỉ có **cột placeholder** trong `clinical_record`: `voice_note_url`, `voice_transcript`, `voice_note_reviewed` (migration 017).
- KHÔNG có speech-to-text, KHÔNG có pipeline transcription, KHÔNG có sub-graph clinical/EMR write nối vào orchestrator.
- **Kết luận: Voice-to-EMR chưa làm — kể cả nhánh text-EMR cũng chưa wired. Mới có schema cột chờ data.**

---

## ĐỒNG BỘ VỚI PLANNER (5 dòng)

1. **DB: 17/35 bảng canon** (D4 đủ 5/5; D7 Finance + D8 Inventory = 0 bảng). 18 bảng thiếu = đúng phân kỳ Phase 2/3, RIÊNG 3 bảng Phase-1 (PatientContactChannel/BookingChannel/PatientNextOfKin) bị ép phẳng thành cột TEXT — nợ thật.
2. **Data BN THẬT chưa vào DB** — patient=30 (demo), transform 5728 còn ở file. NHỊP 2 LOAD chưa chạy. Seed cũng dở: service_type=1 (cần 15), staff=0 (chưa apply).
3. **Code: 4/5 sub-graph thật** (scheduling, lab_triage, task_manager, pre_visit_brief); communication còn stub; pre_visit_brief chưa nối orchestrator. 412 test, 12 skip.
4. **Voice-to-EMR = 0%** (chưa có speech-to-text, chỉ có cột DB chờ).
5. **Việc tiếp theo (theo phụ thuộc):** (a) tạo migration `prescription` + cân nhắc `patient_contact_channel` TRƯỚC khi LOAD; (b) sửa seed service_type (15) + apply seed staff; (c) đóng Task Packet NHỊP 2 LOAD staging; (d) sau đó mới tới lab_triage P9.4 hoàn thiện / communication / voice.

---

*SYSTEM_STATE_ACTUAL.md · khảo sát read-only 2026-05-25 · không sửa code, không chạy migration, không ghi DB.*
