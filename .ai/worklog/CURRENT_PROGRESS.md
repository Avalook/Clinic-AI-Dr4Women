# Handoff Worklog — ClinicAI P9.5
_Updated: 2026-05-21 | Branch: main_

## TRẠNG THÁI HIỆN TẠI
- **P9.5 Pre-visit Brief Graph: DONE** (last commit `e4a075d`)
- **Test baseline:** 345 passed + 6 skipped
- **Branch:** `main` (local only, chưa push)

## COMMITS P9.x ROADMAP
| Hash | Task | Nội dung |
|------|------|----------|
| a9eed37 | P9.1 | Scheduling Graph |
| 56ad8e3..e4dd9f3 | P9.2 | Lab Triage Graph (5 commits) |
| 7855928 | merge | P8+P9.2 → main |
| cd5cd55 | P9.3 | Task Manager Graph (migration 016, tools/task/) |
| e4a075d | P9.5 | Pre-visit Brief Graph (API on-demand) |

## SCHEMA STATE (verified)
- ✅ patient, staff, work_session, clinic_location, appointment, lab_result, task, task_event
- ❌ visit (CHƯA CÓ) — P9.5 fallback dùng appointment(status=COMPLETED)
- ❌ patient_summary materialized (CHƯA CÓ) — P9.5 dùng Mode B on-demand
- ❌ ultrasound_summary (CHƯA CÓ) — P9.5 fallback empty section
- ❌ ongoing_issues structured (CHƯA CÓ) — confidence LLM tự hạ

## TODO P13 (deferred technical debt)
- Flip USE_MATERIALIZED=True khi patient_summary table được build
- Implement cron trigger 30' trước WorkSession → call brief API
- Build visit table proper (hiện dùng appointment proxy)
- Build ultrasound_summary table
- Wire previsit_brief vào orchestrator (event-driven fallback)

## STUB NODES CÒN LẠI
- `communication_stub_node` — P9.4 chờ Zalo OA credential
- `previsit_brief_stub_node` — giữ làm event-driven fallback (defer P13)
- `*_stub_node` các cái khác — fallback khi pool=None

## VIỆC CẦN LÀM KHI SESSION MỚI
1. **NGAY:** Quyết định P9.4 Communication hay defer chờ Zalo cred
2. **Lựa chọn khác:** P9.6 StaffCapability multi-role backup
3. **Hoặc:** Cleanup _classify_stub_backup.py + audit stub cleanup tổng thể

## KIẾN TRÚC QUYẾT ĐỊNH (KHÔNG thay đổi)
- Brief on-demand qua API, KHÔNG event-driven ở P9.5
- LLM tier="main_brain" (Sonnet) cho brief — chất lượng > cost
- Output: JSON structured + Markdown helper (cả hai)
- Auto-detect materialized vs on-demand, source_mode field trong output
- Safety bias: insufficient data → confidence < 0.5, KHÔNG bịa
