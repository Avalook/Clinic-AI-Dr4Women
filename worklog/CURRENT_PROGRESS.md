# ClinicAI — Handoff Worklog

> Bộ nhớ chuyển giao giữa các session chat. Đọc file này đầu mỗi session mới.
> Cập nhật: 2026-05-22 (cuối session) · Dev: Tuyền (solo) · Executor: Claude Code

---

## TRẠNG THÁI HIỆN TẠI

**Branch:** main. Sau session này ĐÃ PUSH (hết local-only).

**Đã DONE:** P1-P6, P8, P9.1 (a9eed37), P9.2 (e4dd9f3), P9.3 (cd5cd55), P9.5 (f4fa959), P9.7a (a7bd769), **P9.7b (5972dc2)**.

**Test baseline:** 398 passed + 6 skipped (sau P9.7b).

**Lưu ý lịch sử commit:** P-IMPORT-0 (813a023) nằm TRƯỚC P9.7b trên main. P9.7a (a7bd769) là cha của 813a023. mig018 build trên HEAD 813a023 (đã xác nhận hợp lệ — P-IMPORT-0 chỉ thêm script audit, không đụng migration).

---

## ĐANG DỞ — VIỆC TIẾP THEO NGAY

### P9.7c — CHƯA phát, làm đầu session sau
- Nội dung: wire lại P9.5 Pre-visit Brief ĐỌC DỮ LIỆU THẬT, **bỏ fallback Mode B**.
- Repo layer đọc visit + clinical_record + patient_summary (VIEW mig018).
- Ánh xạ tên canon: tên cũ "ultrasound_summary" SAI → đúng là `ultrasound_record`.
- VIEW patient_summary expose: patient_code, full_name, date_of_birth, phone_primary, national_id_number, last visit, tổng visit, lịch hẹn tới, lab gần nhất + triage_group.
- Sửa test cho khớp.
- → Xong P9.7c là ĐÓNG TRỌN chương clinical domain.

---

## NỢ KỸ THUẬT GHI NHẬN (không chặn, xử lý trước production)

- Test toàn bộ ở tầng mock-pool + SQL-content. Repo CHƯA có integration harness Postgres thật.
- Hệ quả: trigger finalized_block (P9.7a) + FK constraint (P9.7b) + amendment append-only CHƯA được kiểm chứng chạy thật ở tầng DB — chỉ assert nội dung SQL.
- TODO trước production: dựng Postgres test harness + integration test cho các Medical Safety Gate.

---

## CHIẾN DỊCH IMPORT DATA (lớn, làm sau P9.7c)

P-IMPORT-0 đã khảo sát xong (commit 813a023). 4 phát hiện ĐỔI KẾ HOẠCH:
1. Data 16 CSV Notion subpages (~198k dòng) KHÔNG tabular — SĐT/tên nhồi chung 1 string → ETL regex per-file.
2. 0/16 file có CCCD → MPI mất anchor mạnh, dùng tổ hợp name+DOB+phone → đa số ca rơi HUMAN_REVIEW_QUEUE.
3. Trùng chéo file vì 1 BN ở nhiều subpage → gom dọc trước khi dedup.
4. Header drift mạnh (cột name 6 biến thể + false-positive 'Tên dịch vụ/thuốc/XN') → CẦN file mapping per-source THỦ CÔNG.

Pipeline import 6 lớp: 0 MAPPING (việc người) → 1 EXTRACT (regex) → 2 PROFILE → 3 CLEAN+MPI (gom dọc) → 4 COMMIT.

Bước kế: lớp 0 MAPPING — Tuyền + AI lập file mapping per-source từ PROFILE_REPORT.md, rồi phát P-IMPORT-1 (EXTRACT).

BẢO MẬT: KHÔNG commit data BN lên git. data_audit/ đã gitignore.

---

## DASHBOARD (đã có mockup, để sau import)

Mockup tĩnh 4 màn hình đã dựng: Ca làm / Bệnh nhân / Việc cần làm / Lịch hẹn. Layout chốt sơ bộ, dùng làm bản vẽ cho Claude Code build Next.js thật SAU khi import có data. Không build trước (sẽ ra vỏ rỗng).

---

## ĐỘ LỆCH DOC vs THỰC TẾ (cần buổi review với anh Quang)

1. AI model: doc ghi Gemini → thực tế Anthropic Sonnet/Haiku. KHÔNG dùng Gemini.
2. Executor: doc ghi Antigravity → thực tế Claude Code. KHÔNG dùng Antigravity.
3. LangGraph: doc ghi 1.0 → thực tế 0.6.11.
4. lab_result: doc ghi result_classification → DB thật triage_group (A/B/C/PENDING) + reviewed_at.
5. patient: doc ngụ ý cột phone → DB thật phone_primary + phone_secondary.
6. Thứ tự sub-graph đảo: Communication làm CUỐI (chờ Zalo cred).

---

## NÚT THẮT CẦN TEAM GỠ (không phải việc dev)

- Token Zalo OA + Pancake API key (anh Quang/Hoa) → chặn P9.4 Communication + P12.
- Anh Quang chốt: model = Anthropic, executor = Claude Code, Q-19 = materialized hay on-demand (hiện tạm VIEW on-demand).

---

## QUY TRÌNH (giữ nguyên)

Task Packet: Step 0 verify → Step 1 khảo sát read-only → Step 2-3 code+test → Step 4 lint/mypy/pytest → Step 5 commit local → Step 6 báo cáo 5 dòng. AI Chat ra packet, Tuyền paste chạy, dán Step 6, AI verify + update memory/worklog.
