# CURRENT_PROGRESS.md
_Cập nhật: 2026-05-21 cuối session P8-04. Handoff cho session sau (T-P8-05)._

## Phase tổng quan
```
P1-P6                ✅ DONE
P8 Orchestrator      🟡 IN PROGRESS
  T-P8-01 skeleton           ✅ 45e2da6 (LangGraph + MemorySaver + mock nodes)
  T-P8-02 checkpointer       ✅ 66175f3 (AsyncPostgresSaver + DI lifespan)
  T-P8-03 LLM gateway        ✅ 6f775e5 (AnthropicClient + retry + DI)
  T-P8-04 LLM classify       ✅ 2baaa46 (Haiku classify_intent + fallback)
  T-P8-05 Sonnet respond     ⏭ NEXT — swap respond_node sang Sonnet 4.6
  T-P8-06 Conditional edges  ⏳ sau P8-05
P9.x sub-graphs      ⏳ sau P8 done
```

## Test count: 179 passed + 5 skipped
- 3 RabbitMQ (defer T-P5-02)
- 1 postgres checkpointer (skip nếu no DSN, hiện đang PASS với Supabase)
- 1 Haiku integration (skip no key)

## Stack confirmed (KHÔNG ĐỔI)
- LangGraph 0.6.11 + langchain-core 0.3.86
- langgraph-checkpoint-postgres 2.0.25 + psycopg 3.3.4
- anthropic 0.52.0 + tenacity 9.1.4
- Models: MAIN_BRAIN=claude-sonnet-4-6 (Sonnet 4.6) + GATEWAY=claude-haiku-4-5-20251001 (Haiku 4.5)
- WARNING: Sonnet 4 claude-sonnet-4-20250514 RETIRED 20 Apr 2026 — KHÔNG dùng

## Git state
```
Branch: feature/p8-orchestrator (pushed origin, clean)
Last 5 commits:
  2baaa46 feat(orchestrator): T-P8-04 LLM-powered intent classification (Haiku 4.5)
  6f775e5 feat(llm): T-P8-03 Anthropic SDK gateway client
  66175f3 feat(orchestrator): T-P8-02 hybrid checkpointer + DI lifespan
  45e2da6 feat(orchestrator): T-P8-01 LangGraph skeleton + MemorySaver
  4f37d67 docs(worklog): handoff P6 complete + P8 setup

Branches state:
  main                    = 4f7cd62 (P3 only) — CHƯA merge P4-P8 (NỢ)
  feature/p4-p5-bundle    = cdeac7d (P6 final, tag v0.6.0-tools-layer)
  feature/p8-orchestrator = 2baaa46 (HEAD)
```

## Module structure hiện tại
```
src/clinicai/
├── orchestrator/
│   ├── state.py              OrchestratorState TypedDict
│   ├── nodes.py              rule-based fallback: classify_intent_rule_based + classify_intent_node + respond_node
│   ├── llm_nodes.py          make_classify_intent_llm_node(llm) — Haiku-powered
│   ├── graph.py              build_orchestrator_graph(checkpointer, llm_client=None)
│   ├── service.py            OrchestratorService (DI checkpointer + llm_client)
│   └── checkpointer.py       make_checkpointer() async-context, memory|postgres
├── llm/
│   ├── models.py             MAIN_BRAIN_MODEL, GATEWAY_MODEL, MODEL_BY_TIER, DEFAULT_MAX_TOKENS
│   └── anthropic_client.py   AnthropicClient + LLMResponse + AsyncRetrying
└── tools/ + services/        (P3-P6, không đổi)
```

## T-P8-05 SCOPE (NEXT — paste session sau)

**Mục tiêu:** Swap respond_node từ template static sang Sonnet 4.6 LLM thật.
Tạo `make_respond_node_llm(llm)` factory tương tự T-P8-04, dùng tier="main_brain".

**Design:**
- System prompt Vietnamese chuyên gia y khoa Dr4Women, friendly + professional + tránh tự ý chẩn đoán
- Input cho LLM: state.route + state.user_message → natural Vietnamese response
- KHÔNG ép JSON output (prose tự do)
- Fallback template (nodes.py respond_node hiện tại) nếu LLM fail
- Graph factory thêm param: build_orchestrator_graph(checkpointer, llm_client, use_llm_respond=True default True nếu có llm_client)
- Test pattern same T-P8-04: 4-5 mock tests + 1 integration
- Note safety: System prompt PHẢI nhắc Sonnet không chẩn đoán/kê đơn, chỉ trả lời chung và hướng dẫn đặt khám

**Expected:** 179 + 5 = ≥184 passed.

**Cost note:** Sonnet đắt 3x Haiku ($3/$15 vs $1/$5 per 1M tok). Test integration dùng max_tokens=200, temperature=0.3.

## T-P8-06 PREVIEW (sau P8-05)

Hiện graph linear: START → classify → respond → END.
P8-06 thêm conditional edges + sub-graph stub:
- classify_intent → conditional router function → 5 routes branch
- Mỗi route → sub-graph stub placeholder (P9.x sẽ implement thật)
- general route → respond_node trực tiếp

## Workflow rules (vẫn áp dụng)
1. BƯỚC 0 Task Packet: verify git clean + pytest baseline
2. Tuyền paste output → Claude verify → cấp packet tiếp theo
3. Báo % context window cuối mỗi response
4. Antigravity/Claude Code = executor; Claude Chat = planner

## Lưu ý session sau
- Mở file này đầu session, paste vào Claude Chat
- Xác nhận `git log --oneline -3` đỉnh = 2baaa46
- Verify `poetry run pytest -q 2>&1 | tail -2` = 179 passed + 5 skipped
- Branch hiện tại: feature/p8-orchestrator (KHÔNG đổi branch)

## Nợ kỹ thuật mở (không cản P8)
- Merge feature/p4-p5-bundle vào main
- RabbitMQ bind mount T-P5-02
- Xóa `version:` docker-compose.yml (1 dòng)
- Pytest asyncio_default_fixture_loop_scope config (1 dòng)
- ANTHROPIC_API_KEY: muốn integration test pass thật → export hoặc .env

## Critical reminders cho session sau
- KHÔNG dùng Sonnet 4 cũ (retired). MAIN_BRAIN = "claude-sonnet-4-6"
- Closure factory pattern same T-P8-04 (đã hoạt động tốt)
- Fallback 3 lớp như classify_intent_llm: empty → API err → parse err
- KHÔNG đụng sub-graphs (P9.x scope)
- Y khoa safety: Sonnet system prompt phải có rule "KHÔNG chẩn đoán, KHÔNG kê đơn, chỉ tư vấn chung + đề xuất đặt khám"
