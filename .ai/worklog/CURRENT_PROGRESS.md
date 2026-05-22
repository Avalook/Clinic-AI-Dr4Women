# CURRENT_PROGRESS — Handoff Worklog
> Session: 2026-05-22 · Architect: Claude Chat · Dev: Tuyền (solo)
> Status: CLINICAL DOMAIN CLOSED ✓

## DONE THIS SESSION
- **P9.7c** (commit 9d9b3b0): Wire pre_visit_brief vào patient_summary VIEW +
  ultrasound_record. Drop Mode B hoàn toàn (USE_MATERIALIZED, SourceMode,
  _aggregate_on_demand, source_mode field/stamping/prompt/markdown/log/tests).
  Brief sinh từ VIEW on-demand + latest ultrasound, concurrent 5-fetch
  asyncio.gather. Node→service (A-23 ✓, no direct DB).
- **Gemini sweep: CLEAN** — grep src/**/*.py + *.toml/*.env/*.yaml = 0 match.
  Codebase + canon thuần Anthropic. AnthropicClient (tier gateway→Haiku,
  main_brain→Sonnet), KHÔNG model_gateway.py, KHÔNG Gemini.
- **D025 reconciled** (commit ca315c7): 9 fields = 7 clinical core (BS Hùng) +
  2 AI scaffolding (headline, suggested_questions). P9.7c KHÔNG thêm field —
  ultrasound/next-appt hòa vào core qua LLM. Status vẫn tentative chờ BS Thành P2.

## STATE
- Tests: 401 passed + 6 skipped (was 398+6, +3 net). mypy 271 (improved 7).
- Test tier: mock-pool, CHƯA có Postgres harness (pre-existing).
- main pushed origin: 9d9b3b0 + ca315c7.
- Clinical domain: ĐÓNG. 6 sub-graph wiring xong phần clinical.

## OPEN / NEXT
- **Q-19**: VIEW on-demand vs materialized — tạm on-demand, real-time, no refresh
  hook. Revisit nếu latency degrade.
- **D025**: tentative — chờ BS Thành Phase 2 sign-off tên 7 core chính xác.
- **nodes.py**: factory functions thiếu return-type annotation (pre-existing,
  K3 chưa fix). → T-NEXT candidate.
- **T-AUDIT-01 CHƯA CHẠY**: gap report 16 CSV ↔ schema v6. Đã biết trước:
  CCCD 0/16 file (national_id_number trống), trùng chéo file, header drift.
  → ưu tiên next session (đang chờ scope: bảng gap + đề xuất NULL/backfill/review queue).
- **P9.4 Lab Triage**: còn chờ (Zalo). Communication graph cũng chờ Pancake/Zalo.

## CANON NOTE (sửa cho session sau)
- System prompt mẫu CANON v6 còn lệch: "Gemini 3.5 Flash (Model Gateway)" →
  phải sửa thành "Anthropic Sonnet (Main Brain) + Haiku (Gateway)".
- Bỏ dòng "Google Antigravity SDK" trong system prompt — đã KHÔNG dùng Antigravity.

## NEXT ACTION
1. (nếu cần) T-AUDIT-01 data gap report.
2. P9.4 / Communication khi Zalo+Pancake sẵn.
