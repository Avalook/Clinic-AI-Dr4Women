# Handoff Worklog — ClinicAI P9.2
_Updated: 2026-05-21 | Branch: feature/p8-orchestrator_

## TRẠNG THÁI HIỆN TẠI
- **P9.2 Lab Triage Graph: DONE** (last commit `e4dd9f3`)
- **Test baseline:** 291 passed + 6 skipped
- **Branch:** `feature/p8-orchestrator` (chưa merge main `4f7cd62`)

## COMMITS P9.2 (chronological)
| Hash | Task | Nội dung |
|------|------|----------|
| 56ad8e3 | T-P9.2-00 | migration 015 lab_result + spec |
| 9e87e05 | T-P9.2-01 | skeleton graphs/lab_triage/ |
| 72d2524 | T-P9.2-02 | tool query_lab_result + 10 tests |
| 90354f0 | T-P9.2-03 | classify REAL (rules + LLM fallback) + 15 tests |
| e4dd9f3 | T-P9.2-04 | wire lab_triage → orchestrator + 9 tests |

## SCHEMA ĐÃ LOCK (lab_result thật)
- `triage_group` (KHÔNG result_classification)
- `reviewed_at` + `reviewed_by_staff_id` (KHÔNG bs_reviewed_at)
- `is_finalized BOOL` (KHÔNG status TEXT)
- `result_received_at` (KHÔNG received_at)
- `reference_range_low` + `reference_range_high` NUMERIC (tách)
- `lab_provider TEXT` (KHÔNG lab_partner_id UUID)
- `result_numeric`, `flag`, `panel_code`, `triage_reason`, `requires_doctor_review`, `sample_collected_at`

## LLM CLIENT THẬT
- File: `src/clinicai/llm/anthropic_client.py` → class `AnthropicClient`
- Param: `tier="gateway"` (Haiku) | `tier="main_brain"` (Sonnet)
- KHÔNG có `ModelGateway` hay `model_gateway.py`
- Import pattern: `from clinicai.tools._common.context import TraceContext`
- Test pattern: mock-pool (xem `test_find_work_sessions.py`), KHÔNG seed DB

## STUB NODES CHƯA IMPLEMENT (cần P9.3+)
- `create_review_tasks_node` — GROUP_C → tạo task cho BS review
- `prepare_notification_node` — GROUP_A/B → Zalo notify BN (chờ P12)
- Multi-row batch triage (single-row architecture giữ nguyên đến event-driven ready)
- `_classify_stub_backup.py` — có thể xóa sau P9.2 clean-up

## VIỆC CẦN LÀM KHI SESSION MỚI
1. **NGAY:** Merge `feature/p8-orchestrator` → `main` (nợ từ 4f7cd62)
2. **P9.3:** Task Manager Graph
   - `create_review_tasks_node` implement thật
   - Task SLA + TaskEvent append-only
   - Wire vào orchestrator
3. **Sau P9.3:** `prepare_notification_node` + Communication Graph (P9.4)

## KIẾN TRÚC QUYẾT ĐỊNH (KHÔNG thay đổi)
- Rules lab triage: hardcode `_rules.py` (JSON-ready format) → migrate KB ở P10 bằng 1 script
- Safety gate: `requires_doctor_review=True` OR `triage_group=GROUP_C` → route review task (KHÔNG raise exception ở graph layer)
- Single-row classify per call (batch = loop từ caller)
- LabTriageState = Pydantic BaseModel (khác OrchestratorState TypedDict) → wrapper node giải quyết
