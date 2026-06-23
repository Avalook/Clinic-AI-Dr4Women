# CLAUDE.md — ClinicAI / Dr4women

Đọc file này ĐẦU TIÊN mỗi session. Không bỏ bước.

## §1 STARTUP RITUAL (bắt buộc)
1. Đọc `context/CURRENT_PROGRESS.md` ← worklog: trạng thái + quyết định + task tiếp theo
2. Đọc `context/SYSTEM_STATE_ACTUAL.md` ← số liệu THẬT (bảng/DB/test đếm từ code). Đây là sự thật, ưu tiên hơn doc canon.
3. Đọc `final_canon/06_HARD_DECISIONS_AND_STYLE.md` §1 (D001-D060) — THAM CHIẾU, không phải sự thật tuyệt đối.
4. Đọc `context/CONSTRAINTS.md`
5. Nếu có task file: đọc `.ai/tasks/<task-id>.md`
6. Báo cáo 3-5 dòng hiểu hiện trạng. Đợi lệnh.

## §2 PHASE HIỆN TẠI
- **Giai đoạn:** Data import (TRANSFORM xong, LOAD chưa chạy) + Dashboard Phase 1.
- **DB thật:** 17/35 bảng. Data 5.728 BN còn ở file staged, CHƯA load vào DB.
- **Việc đang làm:** Dashboard luồng "CSKH ghi khách+lịch → bác sĩ xem lịch+BN mình khám" (phân quyền role + màn hình ghi). Kiến trúc data-path: tạo BN qua FastAPI (MPI chống trùng), đọc qua Supabase.
- **Cập nhật mục này mỗi khi đổi giai đoạn. Chi tiết luôn ở context/CURRENT_PROGRESS.md.**

## §3 RULES TỐI THƯỢNG
- KHÔNG sửa file ngoài scope task
- KHÔNG skip test
- KHÔNG tự quyết safety gate (GROUP_C lab, FINALIZED visit)
- KHÔNG deploy production tự động
- **NHÁNH — luồng 2 CỔNG (Quang chốt từng cổng, cập nhật 2026-06-23):**
  - **Mọi thay đổi code/commit DIỄN RA TRÊN `chinh`.** Đây là nhánh làm việc duy nhất. TUYỆT ĐỐI không code/commit trực tiếp lên `feat/t-transform-01`.
  - **CỔNG 1 — push `chinh`:** chỉ `git push` nhánh `chinh` KHI Quang xem và nói **"OK"**. Không tự push (xem cả dòng "KHÔNG push khi chưa được lệnh" bên dưới).
  - **CỔNG 2 — đưa lên PRODUCTION:** `feat/t-transform-01` = nhánh PRODUCTION nối Vercel (phòng khám ĐANG nhìn thấy; autoDeploy mỗi lần push). Chỉ merge `chinh` → `feat/t-transform-01` KHI Quang nói **"CHỐT"** **và** có lệnh rõ ràng. Merge xong mới là thứ phòng khám thấy.
  - **Đầu mỗi phiên:** kiểm tra đang ở `chinh`; nếu lỡ đang ở `feat/t-transform-01` thì DỪNG, báo, `git checkout chinh` rồi mới làm.
- KHÔNG push khi chưa được lệnh; commit local theo Task Packet
- **KHÔNG tạo file trùng tên ở thư mục khác.** Worklog DUY NHẤT = `context/CURRENT_PROGRESS.md`. Số liệu thật DUY NHẤT = `context/SYSTEM_STATE_ACTUAL.md`. Thấy bản trùng tên ở chỗ khác → báo để xóa.
- **Doc canon (final_canon/, file 00-11) là THAM CHIẾU, KHÔNG phải sự thật.** Đã lệch nhiều lần (Gemini→Anthropic, 16→14 file, Voice-to-EMR khoe nhầm). Khi nghi ngờ số liệu/trạng thái → khảo sát code thật, không tin doc, không đoán.
- Khi không chắc → STOP, hỏi Claude Chat (Planner)

## §4 QUY TRÌNH PHIÊN (Planner ↔ Executor)
- Planner (Claude web chat) ra Task Packet. Executor (Claude Code) chạy.
- Task Packet: Step 0 verify → 1 khảo sát read-only → 2-3 code+test → 4 lint/mypy/pytest → 5 commit local → 6 báo cáo 5 dòng.
- Cuối phiên: cập nhật `context/CURRENT_PROGRESS.md` (ghi cả QUYẾT ĐỊNH + LÝ DO, không chỉ việc đã làm) → commit → push → tree clean.

## §5 LINKS NHANH
- Worklog: `context/CURRENT_PROGRESS.md`
- Số liệu thật: `context/SYSTEM_STATE_ACTUAL.md`
- Decisions locked: `final_canon/06_HARD_DECISIONS_AND_STYLE.md`
- DB schema: `final_canon/05_DATABASE_DESIGN_FINAL.md`
- Task/Report template: `.ai/TASK_TEMPLATE.md`, `.ai/REPORT_TEMPLATE.md`
