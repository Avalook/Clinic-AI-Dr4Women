# CURRENT_PROGRESS — Handoff Worklog
> Session: 2026-05-24 (web chat planning) · Next session đọc file này trước

## TRẠNG THÁI HỆ THỐNG (chốt phiên này)
- Lõi VỮNG: schema 35 entities + migrations/rollback, Patient/MPI, safety-gate 017
  (5/5 pass, chặn thật), 5/6 sub-graph (P9.1-9.3,9.5,9.7), Docker local C1 (3 svc healthy).
- CHƯA chạy end-to-end. 5 gap chặn: (1) chưa có data BN thật trong DB
  (16 CSV mới profiling P-IMPORT-0), (2) P9.4 Lab Triage chưa code,
  (3) Zalo còn stub (P12), (4) chưa deploy prod (C2/C3), (5) T-AUDIT-01 chưa chạy.
- Code: tốt ĐỦ cho giai đoạn vertical slice. CHƯA audit theo 02_CODING_RULES
  (33 forbidden + 14 mandatory) — để dành làm task riêng SAU khi có 1 luồng e2e.

## QUYẾT ĐỊNH PHIÊN NÀY
- Anthropic-only confirmed (Gemini/Antigravity là canon chết, bỏ). Memory đã đúng, không sửa.
- Việc làm TRƯỚC = T-AUDIT-01 (gap 16 CSV vs schema v6) — nút thắt mở đường data.
- Kế hoạch test phòng khám = build ngược từ DEMO-1 (read-only Dashboard hiển thị
  BN thật đã import). An toàn, rẻ, gây niềm tin. KHÔNG cần Zalo/Lab/prod.
  Đường: A) T-AUDIT-01 → B) P-IMPORT 1-2 EXTRACT+CLEAN+MPI → C) import staging schema
  (KHÔNG prod) → D) Dashboard /patients đọc data thật → E) cho 1 người PK bấm thử.

## ĐANG CHỜ TUYỀN QUYẾT (mở task tiếp)
- Phạm vi T-AUDIT-01: [ ] 4 bảng chính (patient/contact/medical_profile/pregnancy)
  ← Claude KHUYẾN NGHỊ, đủ cho DEMO-1 | [ ] toàn bộ bảng đích | [ ] Claude Code tự quyết
- Sau khi chốt phạm vi → Claude xuất Task Packet cho Claude Code (có Step 0 verify state).

## T-AUDIT-01 SCOPE (đã phác)
- INPUT: 16 CSV Notion + schema v6 thật (từ migrations đã apply)
- OUTPUT: report mapping mỗi CSV→bảng đích, cột khớp/lệch/thiếu/thừa,
  cột NOT NULL không có nguồn → sẽ chặn import
- ZERO: không ghi DB, không commit data BN, không sửa CSV gốc
- Nền sẵn: scripts/data_audit/profile.py (813a023, P-IMPORT-0)

## NỢ MÔI TRƯỜNG (carry-over từ C1 — QUAN TRỌNG cho C3)
- Mac Mini headless qua SSH (`100.119.13.22` = Tailscale). Để build/pull ẩn danh trong
  session non-interactive (keychain khóa) đã sửa:
  1. `~/.docker/config.json`: bỏ `credsStore` + hooks scout/ai. Backup: `~/.docker/config.json.bak`.
  2. Rename 2 credential helper → `.disabled`:
     `/usr/local/bin/docker-credential-desktop` + `docker-credential-osxkeychain`.
- ⚠️ C3 cần `docker login ghcr.io` → PHẢI khôi phục 2 helper TRƯỚC:
  `mv <path>.disabled <path>` (cả 2 file) + cân nhắc restore credsStore từ config.json.bak.
- C1 commit: c6d384a (pushed). Entry app THẬT = `clinicai.main:app`. worker/scheduler chưa có.
