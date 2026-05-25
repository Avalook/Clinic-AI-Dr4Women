# CURRENT_PROGRESS — Handoff Worklog
> Cập nhật: 2026-05-24 (web chat planning, phiên EDA + transform) · Phiên sau đọc file này trước

## TRẠNG THÁI HỆ THỐNG
- Lõi VỮNG: schema 35 entities + migrations/rollback, Patient/MPI, safety-gate 017
  (5/5 pass, chặn thật), 5/6 sub-graph (P9.1-9.3,9.5,9.7), Docker local C1 (3 svc healthy).
- CHƯA chạy end-to-end. Gap: (1) data BN thật chưa vào DB — ĐANG XỬ qua T-TRANSFORM-01,
  (2) P9.4 Lab Triage chưa code, (3) Zalo còn stub (P12), (4) chưa deploy prod (C2/C3).

## QUYẾT ĐỊNH CHỐT PHIÊN NÀY
- Định danh: clinic_patient_id = UUID tự sinh. Dedup = phone+tên+DOB (KHÔNG có CCCD).
  CCCD = NULL, backfill giai đoạn sau (phòng khám thu dần khi dùng dashboard). Khớp schema mục 3.
- Migration 2 NHỊP: NHỊP 1 TRANSFORM (CSV→file sạch, KHÔNG ghi DB) → NHỊP 2 LOAD
  (staging→review rổ vàng→prod). Đang ở NHỊP 1.
- Demo phòng khám = DEMO-1 read-only dashboard hiển thị BN thật + shadow-mode
  (CSKH nhập song song Notion + dashboard tới cuối tháng). Bẫy: nhập song song = gấp đôi việc,
  dashboard phải NHANH hơn/cho thứ Notion không có (gõ SĐT ra lịch sử) nếu không CSKH bỏ.

## PHÁT HIỆN EDA QUAN TRỌNG (đã verify bằng Python trên data thật)
- **Memory #9 SAI**: KHÔNG phải "0 CCCD, không tabular, SĐT nhồi 1 string". Thực tế bảng
  hành chính ĐÃ có cột `//họ tên (neat)` + `//sdt (neat)` tách sẵn (99% phủ), DOB 94%.
- **CỐT LÕI: phòng khám có ~2974 BN, KHÔNG phải 588.** Bảng hành chính (594) chỉ là
  ~573 người CSKH đã làm hồ sơ kỹ. ~2400 SĐT khác CHỈ nằm trong lịch hẹn/XN/thuốc.
  → Patient phải dựng từ UNION mọi SĐT trên 7 bảng. Đây cũng là GIÁ TRỊ bán cho Sếp:
  gom BN rải 6 trang Notion về 1 hồ sơ — Notion họ không làm được.
- Quan hệ giữa bảng: KHÔNG có FK, link bằng chuỗi text "Tên 0xxxxxxxxx". Resolve bằng
  regex bóc SĐT (0\d{9}) từ toàn bộ field → normalize E.164 → tra index phone→uuid.
- 3 rổ: 🟢 XANH ~573 (hồ sơ đủ) | 🟡 VÀNG ~2400 (chỉ tên+SĐT, skeleton) | 🔴 ĐỎ ~50 dòng (không SĐT, reject).
- Rổ ĐỎ chỉ ~1% → data import được gần như toàn bộ. Không có thảm họa data.

## DATA — sự thật kỹ thuật (cho transform/audit)
- 7 nhóm CSV, LUÔN dùng bản hậu tố `_all` (đầy đủ hơn bản thường: XN 64 vs 5033!).
- Encoding utf-8-sig. CÓ newline trong ô → ĐỌC bằng csv.DictReader, KHÔNG pd.read_csv C-engine (vỡ).
- File .md = record con xuất riêng, nội dung ĐÃ nằm trong CSV → BỎ QUA toàn bộ .md.
- Số dòng thật: hành chính 594, lịch hẹn 1891, XN 5033, thuốc 1677, lâm sàng 576, CSKH 3393, dịch vụ 1046.

## VỊ TRÍ DATA (QUAN TRỌNG — chống lộ data y tế)
- Data BN ĐỂ NGOÀI repo, ngang hàng (vd ../_clinic_data_raw/notion_export/), git KHÔNG thấy.
- KHÔNG chuyển data vào trong folder repo. transform.py nhận đường dẫn qua --input-dir.
- Output staged files ra scripts/data_migration/output/ (gitignore). KHÔNG commit data BN.

## ĐANG CHỜ / VIỆC TIẾP
- ĐANG GIAO: T-TRANSFORM-01 (Task Packet đã xuất, file riêng) cho Claude Code chạy full ở máy.
  NHỊP 1 transform → 8 file output + TRANSFORM_REPORT.md. Read-only với DB.
- SAU khi Tuyền soi output OK → Claude đóng Task Packet NHỊP 2 (LOAD vào staging).
- CHỜ Sếp/PM: (1) phòng khám thu CCCD từ giờ không? (2) báo trước data đóng băng ~1 tháng.
- Mẫu transform 3 BN đã chạy thử thành công trong phiên (chứng minh gom-1-hồ-sơ khả thi).

## NỢ MÔI TRƯỜNG (carry-over từ C1 — giữ cho C3)
- Mac Mini build qua SSH: đã bỏ credsStore + scout/ai hooks trong ~/.docker/config.json
  (backup config.json.bak). Rename 2 helper .disabled: docker-credential-desktop +
  docker-credential-osxkeychain. Pull ẩn danh OK.
- C3 cần docker login đẩy ghcr.io → PHẢI khôi phục 2 helper trước (mv .disabled về tên gốc).

## === CẬP NHẬT: T-TRANSFORM-01 DONE (NHỊP 1) ===
- Commit ef538d5 nhánh feat/t-transform-01 (CHƯA push). ruff+mypy strict+20/20 test pass. Không ghi DB, không commit data BN.
- **BASELINE THẬT (số planning cũ 594/2974 SAI — từ bản non-_all; LUÔN dùng _all):**
  Patient 5728 (🟢 COMPLETE 2771 đủ DOB+gender | 🟡 SKELETON 2957 tên+SĐT).
  appt 10032→9996 · lab 5033→5010 · rx 15415→15319 · clin 6182→6013. reject 415 (~2%, SĐT lỗi nguồn, KHÔNG phải lỗi parse). review_queue 220 (trùng SĐT khác tên, duyệt tay).
- 8 file output ở scripts/data_migration/output/ (gitignore).
- **3 LỆCH SCHEMA cho NHỊP 2 LOAD (QUAN TRỌNG):**
  (1) prescription KHÔNG có bảng đích → file PARKED (no_target_table), cần tạo bảng trước khi load rx.
  (2) clinical_record link qua visit_id (NOT NULL UNIQUE), KHÔNG có clinic_patient_id trực tiếp → LOAD phải tạo visit trước.
  (3) lab_result dùng cột triage_group='PENDING' (KHÔNG phải result_classification).
- NOT NULL thiếu nguồn (LOAD xử): patient.location_id (default 1-clinic), patient.patient_code (DB sinh), appointment.location_id/service_type_id (raw TEXT fk_unresolved=true), appointment.slot_end (suy ra). gender/address giữ *_staging.
- TIẾP: Tuyền soi TRANSFORM_REPORT + patient_staged + review_queue → OK thì Claude đóng Task Packet NHỊP 2 (LOAD staging). Cần map raw TEXT (BS Thành/Phụ khoa/Kim Ngưu) → FK master = task con trong NHỊP 2.
