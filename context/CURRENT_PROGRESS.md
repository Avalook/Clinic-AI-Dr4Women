# CURRENT_PROGRESS.md
_Cập nhật: cuối session P9.1 DONE. Handoff cho P9.2 Lab Triage._

## Phase tổng quan
P1-P6                       ✅ DONE
P8 Orchestrator             ✅ DONE  v0.8.0-orchestrator
P9.1 Scheduling sub-graph   ✅ DONE  v0.9.1-scheduling
P9.2 Lab Triage sub-graph   ⏭ NEXT
P9.3-P9.5                   ⏳

## Test count: 242 passed + 6 skipped
- scheduling tests: 34 (24 conversation + 5 tool + 6 mapper + 5 node + 4 E2E/routing)

## Stack confirmed (KHÔNG ĐỔI)
- Models: MAIN_BRAIN=claude-sonnet-4-6, GATEWAY=claude-haiku-4-5-20251001
- LangGraph 0.6.11 + checkpointer Postgres async
- Anthropic 0.52.0 + tenacity 9.1.4

## Git state
Branch: feature/p8-orchestrator (pushed, clean)
HEAD: a9eed37 T-P9.1-04 wire scheduling sub-graph into orchestrator
Tags: v0.6.0-tools-layer | v0.8.0-orchestrator | v0.9.1-scheduling
Main = 4f7cd62 (P3) — nợ merge (dồn sau P9.x done)

## Module structure confirmed
src/clinicai/
├── orchestrator/
│   ├── state.py         (+scheduling fields: step/turn_count/preferred_*/candidate_doctors/confirmed)
│   ├── graph.py         (scheduling_pool + scheduling_location_id params)
│   ├── service.py       (propagates pool + location_id)
│   ├── stubs.py         (4 stubs còn lại: lab_triage/communication/task_manager/previsit_brief)
│   └── ...
├── graphs/
│   └── scheduling/      ✅ COMPLETE
│       ├── state.py     (SchedulingState + SchedulingStep + SchedulingIntent)
│       ├── parsers.py   (parse_date/parse_time_slot/parse_yes_no VN)
│       ├── session_mapper.py (weekday→EVENING, weekend→MORNING/AFTERNOON)
│       ├── nodes.py     (ask_date/ask_time/make_find_doctor_node/confirm)
│       └── graph.py     (build_scheduling_subgraph(pool, location_id))
├── tools/
│   └── scheduling/
│       ├── find_oncall.py           (existing)
│       ├── find_work_sessions.py    ✅ NEW
│       ├── create_appointment.py    ✅ NEW (AppointmentConflictError Safety Gate)
│       ├── confirm_appointment.py   ✅ NEW
│       └── cancel_appointment.py   ✅ NEW

## Orchestrator graph state (full)
START → classify_intent (Haiku) → route_by_intent
  ├─ scheduling   → scheduling sub-graph (REAL) → END
  ├─ lab          → lab_triage_stub → END         ← P9.2 NEXT
  ├─ communication→ communication_stub → END
  ├─ task         → task_manager_stub → END
  ├─ previsit     → previsit_brief_stub → END
  └─ general      → respond (Sonnet) → END

## P9.2 Lab Triage SCOPE (session sau)
Pattern giống P9.1 — 4 micro-tasks:
  T-P9.2-01 skeleton graphs/lab_triage/{state,nodes,graph}.py
  T-P9.2-02 conversation logic: ask_lab_type → triage_classify → advise
  T-P9.2-03 tool: query lab_result table (verify schema migration 013/014)
  T-P9.2-04 wire into orchestrator (thay lab_triage_stub)

Key difference vs P9.1:
  - GROUP_C lab results = Medical Safety Gate (HARD BLOCK application-level, AI chỉ gợi ý)
  - Không có slot-filling multi-turn; flow ngắn hơn (2-3 node)
  - Cần verify bảng lab_result schema từ migrations trước khi code

## Decisions đã chốt (không bàn lại)
- Slot-filling: mỗi node END sau 1 turn, conditional entry từ START theo state.step → TEMPLATE P9.x
- Pool injection: closure factory pattern make_*_node(pool) → TEMPLATE P9.x
- session_type: EVENING (weekday) / WEEKEND_MORNING / WEEKEND_AFTERNOON (không có weekday daytime)
- scheduling_stub_node GIỮ LẠI trong stubs.py làm safety net CI no-DB

## Nợ kỹ thuật mở
- Merge nhánh vào main (sau P9.x done)
- RabbitMQ T-P5-02 bind mount
- confirm_node trong sub-graph chưa gọi create_appointment thật (P9.1-05 nếu cần, hoặc P10)

## Workflow rules
1. BƯỚC 0 verify git + pytest trước mọi task
2. Test path: src/tests/... (KHÔNG phải tests/...)
3. Worklog: context/CURRENT_PROGRESS.md
4. Tuyền paste output → Claude verify → packet tiếp
