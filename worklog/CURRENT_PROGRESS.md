# ClinicAI — Handoff Worklog
> Cập nhật: 2026-05-24 (cuối session) · Dev: Tuyền (solo) · Executor: Claude Code

---
## TRẠNG THÁI HIỆN TẠI
- Clinical domain ĐÓNG TRỌN: P9.7c DONE (ca315c7), bỏ Mode B, wire previsit_brief đọc data thật.
- Test: 401 pass + 6 skip. main đã PUSH tới ca315c7.

## CHIẾN DỊCH IMPORT — NHỊP 1 TRANSFORM DONE (no DB write, branch riêng)
Output ở: `scripts/data_migration/output/` (gitignore — KHÔNG commit data BN).
File: patient_staged / appointment_staged / lab_result_staged / clinical_record_staged / prescription_staged / review_queue / TRANSFORM_REPORT.md

**Baseline THẬT (chốt):**
- Patient: 6090 admin rows → 5728 BN (🟢 2771 đủ DOB+gender · 🟡 2957 tên+SĐT)
  - AUTO_MERGE 99 · REVIEW_CONFLICT 210 · reject 91 (no phone)
- appointment 10032→9996 (rej 36) · lab 5033→5010 (rej 23)
- prescription 15415→15319 (rej 96) · clinical 6182→6013 (rej 169)
- review_queue 220 dòng · reject tổng 415 (~2%, lỗi nguồn đã verify)

**Soi mắt người DONE (phiên này):** review_queue 30 dòng đầu → ~85-90% đúng là đặt hộ/người nhà (tên khác hẳn, nam đặt hộ nữ). Kết luận LÀNH, không tách đôi hàng loạt. MPI tách đúng.

## 3 ĐIỂM CẦN NHỚ CHO NHỊP 2 (đầu vào quan trọng)
1. **prescription PARKED** (no_target_table=true): schema v6 CHƯA có bảng đích.
   → QUYẾT: park rx, NHỊP 2 load 4 bảng kia trước. NHỊP 3 mới thiết kế bảng prescription + load rx.
2. **3 ca gõ-bẩn trong review_queue** cần xử: tên trùng khít chỉ khác hậu tố rác
   ("(huỷ)", dấu gạch cuối, khoảng trắng thừa). VD: Đặng Thị Hoà vs "Đặng Thị Hoà (huỷ)"; "Phạm Thu Thuỷ -" vs "Phạm Thu Thuỷ".
   → ĐỀ XUẤT NHỊP 2: rule normalize BẢO THỦ (trim + bỏ hậu tố huỷ/gạch rác) → auto-merge CHỈ KHI trùng khít 100% sau normalize. Lệch 1 ký tự (vd "Thế Phương Linh" vs "Thế Khánh Linh") → GIỮ trong review queue. CHƯA CHỐT — hỏi Tuyền đầu phiên sau.
3. **Lệch count 210 vs 220**: REVIEW_CONFLICT báo 210 nhưng review_queue.csv có 220 dòng (lệch 10). Không chặn. Khi duyệt tay duyệt TRỌN file, đừng tin con số 210.

## NHỊP 2 (chưa phát — mở đầu phiên sau)
LOAD vào Supabase staging: patient → appointment → lab_result → clinical_record.
- Bổ NOT NULL thiếu nguồn: patient.location_id (default single-clinic), patient_code (DB-gen advisory lock), appointment.slot_end (derive từ slot_start+duration), lab test_code/name (fallback ID/'UNKNOWN').
- clinical_record link qua visit_id (NOT NULL UNIQUE) → LOAD phải tạo parent `visit` trước (visit_unresolved=true).
- Map FK master (doctor/service_type/location/booking_channel hiện raw TEXT fk_unresolved=true).
- Theo Task Packet chuẩn: Step 0 verify → 1 khảo sát → 2-3 load+test FK integrity → 4 lint/mypy/pytest → 5 commit local → 6 báo cáo 5 dòng.

## NỢ / NÚT THẮT (giữ)
- Chưa có Postgres integration harness → Safety Gates (finalized block, FK, amendment append-only) mới test mock-pool/SQL-content, chưa chạy thật DB. Dựng trước production.
- Token Zalo OA + Pancake key (anh Quang/Hoa) → chặn P9.4 Communication.
- Độ lệch doc: Gemini→Anthropic Sonnet/Haiku; Antigravity→Claude Code; LangGraph 1.0→0.6.11. Cần buổi review anh Quang.
