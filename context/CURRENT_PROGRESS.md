# CURRENT_PROGRESS.md
_Cập nhật: cuối session P8 DONE. Handoff cho P9.1 Scheduling sub-graph._

## Phase tổng quan
P1-P6                ✅ DONE
P8 Orchestrator      ✅ DONE
  T-P8-01..06 hoàn tất, graph linear → conditional 6 routes
P9.1 Scheduling      ⏭ NEXT
P9.2-P9.5 sub-graphs ⏳

## Test count: 198 passed + 6 skipped
- 3 RabbitMQ defer
- 1 postgres checkpointer skip nếu no DSN (PASS với Supabase)
- 2 LLM integration skip nếu no ANTHROPIC_API_KEY (Haiku + Sonnet)

## Stack confirmed
- Models: MAIN_BRAIN=claude-sonnet-4-6, GATEWAY=claude-haiku-4-5-20251001
- LangGraph 0.6.11 + checkpointer Postgres async
- Anthropic 0.52.0 + tenacity 9.1.4

## Git state
Branch: feature/p8-orchestrator (pushed, clean)
Last 6 commits:
  4cca306 T-P8-06 conditional routing + 5 stubs
  a7376ef T-P8-05 Sonnet respond
  5e58179 handoff worklog
  2baaa46 T-P8-04 Haiku classify
  6f775e5 T-P8-03 Anthropic gateway
  66175f3 T-P8-02 checkpointer

Main = 4f7cd62 (P3 only) — NỢ merge p4-p5-bundle + p8-orchestrator (dồn merge sau P9.1)

## Graph hiện tại
START → classify_intent (Haiku) → route_by_intent
  ├─ scheduling   → scheduling_stub → END  ← P9.1 thay bằng sub-graph thật
  ├─ lab          → lab_triage_stub → END
  ├─ communication→ communication_stub → END
  ├─ task         → task_manager_stub → END
  ├─ previsit     → previsit_brief_stub → END
  └─ general      → respond (Sonnet) → END

## Module structure
src/clinicai/
├── orchestrator/
│   ├── state.py            (+handled_by)
│   ├── nodes.py            (template fallback)
│   ├── llm_nodes.py        (Haiku classify + Sonnet respond factories)
│   ├── stubs.py            (5 stubs — sẽ migrate dần sang graphs/)
│   ├── graph.py            (conditional edges + route_by_intent)
│   ├── service.py          (DI checkpointer + llm_client + use_llm_respond)
│   └── checkpointer.py
├── llm/
│   ├── models.py
│   └── anthropic_client.py
└── graphs/                 ← CREATE trong P9.1
    └── scheduling/         ← CREATE trong P9.1

## P9.1 Scope (NEXT)
Mục tiêu: thay scheduling_stub_node bằng sub-graph thật.
- Tạo src/clinicai/graphs/scheduling/{__init__.py,state.py,nodes.py,graph.py}
- Conversation flow nhiều turn: hỏi ngày → giờ → bác sĩ → confirm
- Wire tool find_oncall_doctor (đã có từ P6) trong node tool_call
- Sub-graph compile xong import vào orchestrator/graph.py, thay scheduling_stub
- Test: 5-7 tests sub-graph + 2 graph integration

## RouteType literal mở rộng dormant
Hiện tại classify chỉ sinh 5 routes; "task"/"previsit" có edge nhưng dormant.
P9.x mỗi sub-graph tự mở rộng literal + prompt classify khi cần.

## Nợ kỹ thuật mở (không cản P9.1)
- Merge feature/p4-p5-bundle + feature/p8-orchestrator vào main (sau P9.1)
- RabbitMQ T-P5-02 bind mount
- Xóa `version:` docker-compose.yml
- Pytest asyncio_default_fixture_loop_scope config

## Workflow rules
1. Mỗi Task Packet BƯỚC 0 verify git clean + pytest baseline
2. Tuyền paste output → Claude verify → packet tiếp
3. Báo % context cuối mỗi response
4. Antigravity/Claude Code = executor; Claude Chat = planner
