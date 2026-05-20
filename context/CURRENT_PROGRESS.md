# CURRENT_PROGRESS.md
_Cập nhật: 2026-05-20 cuối session. Handoff cho session sau._

## Phase: P5 — EventLog + RabbitMQ
P1+P2+P3+P4 DONE. P5 đang chạy.

## Test count: 117 passed + 3 skipped (MQ tests)

## Stack confirmed
- Python 3.12.9 + Poetry 2.4.1
- FastAPI + asyncpg + structlog
- Antigravity = primary executor
- KHÔNG dùng Gemini — Anthropic Sonnet/Haiku confirmed
- Repo: ~/Projects/AI Clinic Dr4Women/Clinic-AI-Dr4Women

## T-P5-01: DONE ✅
Migration 013: event_log + enforce_append_only trigger
8 tests passing

## T-P5-02: CODE DONE, SMOKE TEST BLOCKED 🟡
Files created: docker-compose.yml, docker/rabbitmq/{rabbitmq.conf,
definitions.json, README.md}, scripts/check_rabbitmq.py,
src/tests/integration/test_rabbitmq_connectivity.py

BLOCKER: ACCESS_REFUSED khi connect RabbitMQ
Root cause: bind mount docker/rabbitmq/data có Erlang mnesia DB cũ
từ lần docker run direct của Antigravity → RABBITMQ_DEFAULT_* env vars
bị ignore → không có user nào được tạo.

Fix đang thực hiện: xóa toàn bộ data trong bind mount, recreate container.
Nếu vẫn fail → đổi sang named volume trong docker-compose.yml.

definitions.json đã patch: xóa "users" và "permissions" section
(plain text password không support trong RabbitMQ 3.13).
User được tạo bởi RABBITMQ_DEFAULT_* env vars.

ACCEPTANCE CRITERIA CÒN THIẾU:
- check_rabbitmq.py exit 0
- 3 integration tests PASSED (hiện skip)

## GIT DEBT — CRITICAL ⚠️
TOÀN BỘ P4 + P5 CHƯA COMMIT. Cần commit ngay đầu session sau:

Commit 1: "feat(staff): P4 staff service + migrations 008-011"
  Files: src/migrations/008-011, src/clinicai/services/staff_service.py,
         src/clinicai/schemas/staff.py, src/clinicai/api/v1/routers/staff.py,
         src/tests/unit/test_staff_service.py, src/tests/api/,
         seed/004_staff.sql

Commit 2: "feat(scheduling): P4 scheduling service + migration 012"
  Files: src/migrations/012, src/clinicai/services/scheduling_service.py,
         src/clinicai/schemas/scheduling.py,
         src/clinicai/api/v1/routers/scheduling.py

Commit 3: "feat(event-log): T-P5-01 append-only event_log + migration 013"
  Files: src/migrations/013, src/tests/test_migrations_013.py

Commit 4: "feat(rabbitmq): T-P5-02 Docker Compose + topology baseline"
  Files: docker-compose.yml, docker/, scripts/check_rabbitmq.py,
         src/tests/integration/test_rabbitmq_connectivity.py,
         .env.example

Commit 5: "fix(core): exceptions + main app updates"
  Files: src/clinicai/api/exceptions.py, src/clinicai/main.py,
         src/clinicai/services/mpi_service.py

## T-P5-03: TASK PACKET READY 📝
EventService + outbox pattern. Paste vào Antigravity khi T-P5-02 done.
Xem session log để lấy full prompt template.

Key design decisions đã chốt:
- event_published BOOLEAN field cần migration 014
- INSERT first, COMMIT, then publish MQ (KHÔNG trong cùng transaction)
- Trigger enforce_append_only cần update: allow UPDATE chỉ
  event_published FALSE→TRUE
- BaseAdapter abstract + Pancake/Zalo placeholder (NotImplementedError)

## Blockers mở
- H-1: v6 schema 35 entities — chờ Anh Quang
- H-8: Qwen3-14B Mac Mini vs VPS — chờ Anh Quang
- Q-30: 1 BN book 2 appt cùng giờ khác BS — chờ Anh Quang
- Q-31: doctor-not-on-duty 409 vs 422 — chờ FE feedback

## Notes cho session sau
- Antigravity = primary executor
- Báo % context cuối mỗi response
- Prompt format: SCOPE+BOUNDARY+CONTEXT+ACCEPTANCE+OUTPUT+NẾU GẶP VẤN ĐỀ
- Docker bind mount issue: cân nhắc đổi sang named volume
- Xóa dòng "version:" trong docker-compose.yml (obsolete warning)
- asyncio_default_fixture_loop_scope warning: thêm vào pytest.ini
