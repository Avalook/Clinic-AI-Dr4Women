# CLAUDE.md — ClinicAI / Dr4women

Đọc file này ĐẦU TIÊN mỗi session. Không bỏ bước.

## §1 STARTUP RITUAL (bắt buộc)

1. Đọc `context/CURRENT_PROGRESS.md` ← trạng thái hiện tại + task tiếp theo
2. Đọc `final_canon/06_HARD_DECISIONS_AND_STYLE.md` §1 (D001-D060)
3. Đọc `context/CONSTRAINTS.md`
4. Nếu có task file: đọc `.ai/tasks/<task-id>.md`
5. Báo cáo 3-5 dòng hiểu hiện trạng. Đợi lệnh.

## §2 PHASE HIỆN TẠI

- **Phase:** P0 — Repo bootstrap
- **Last completed task:** T-P0-03 (khi task này xong, update dòng này)
- **Next task:** T-P1-01 (infrastructure)

## §3 RULES TỐI THƯỢNG

- KHÔNG sửa file ngoài scope task
- KHÔNG skip test
- KHÔNG tự quyết safety gate (GROUP_C lab, FINALIZED visit)
- KHÔNG deploy production tự động
- Khi không chắc → STOP, hỏi Claude Chat

## §4 LINKS NHANH

- Decisions locked: `final_canon/06_HARD_DECISIONS_AND_STYLE.md`
- DB schema: `final_canon/05_DATABASE_DESIGN_FINAL.md`
- Task template: `.ai/TASK_TEMPLATE.md`
- Report template: `.ai/REPORT_TEMPLATE.md`
