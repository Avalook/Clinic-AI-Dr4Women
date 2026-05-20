# CURRENT_PROGRESS.md
_Cập nhật: 2026-05-20 cuối session. Handoff cho session sau._

## Phase tổng quan
```
P1 Bootstrap         ✅ DONE
P2 Master data       ✅ DONE
P3 Patient/MPI       ✅ DONE
P4 Staff/Sched/Appt  ✅ DONE
P5 EventLog/Queue    ✅ CORE DONE (T-P5-04/05/07 còn lại nhỏ, làm cùng P6)
P6 Tools layer       🟡 IN PROGRESS — T-P6-A done, T-P6-B NEXT
P7+ chưa bắt đầu
```

## Test count: 150 passed + 3 skipped (RabbitMQ MQ tests)

## Stack confirmed (KHÔNG ĐỔI)
- Python 3.12.9 + Poetry 2.4.1
- FastAPI + asyncpg + structlog + Pydantic v2
- Anthropic Sonnet (Main Brain) + Haiku (Cost-Effective Gateway) + Qwen3-14B local
- KHÔNG dùng Gemini
- Antigravity / Claude Code = primary executor
- Repo: ~/Projects/AI Clinic Dr4Women/Clinic-AI-Dr4Women
- Branch: `feature/p4-p5-bundle` (đã push origin, PR chưa tạo)

## Git state cuối session
```
Branch: feature/p4-p5-bundle (ahead of main ~10 commits, pushed)
Last commits:
  7d410b9 feat(tools): T-P6-A TraceContext + patient/scheduling/event_log tools
  0df29cf feat(golden-record): T-P5-03B consumer + GoldenRecord skeleton
  3a8913b feat(event-service): T-P5-03A migration 014 + EventService + outbox
  0cd403b chore(scripts): add commit_bundle helper script
  f64bb01 docs(worklog): handoff log P4-P5 session
  33699b1 fix(core): exception handlers, patient router, MPI service
  f9438f1 feat(rabbitmq): T-P5-02 Docker Compose + topology baseline [PARTIAL]
  e7820e5 feat(event-log): T-P5-01 append-only event_log table
  fd71268 feat(scheduling): P4 scheduling service with slot exclusion
  dcef661 feat(staff): P4 staff service with role-based access
  2c268bd chore(gitignore): exclude rabbitmq runtime data dirs
```
Working tree clean. PR cần tạo:
https://github.com/nguyencongtuyenlp/Clinic-AI-Dr4Women/pull/new/feature/p4-p5-bundle

## Đã làm session này
1. ✅ Git debt flush — 6 commit (gitignore + 5 feat/fix + docs worklog)
2. ✅ T-P5-03A — Migration 014 event_published + EventService outbox + 18 tests
3. ✅ T-P5-03B — RabbitMQConsumer + GoldenRecordEngine skeleton + 6 tests
4. ✅ Push branch lên origin
5. ✅ T-P6-A — TraceContext + 3 tools (patient.get_summary, scheduling.find_oncall, event_log.append) + 9 tests

## T-P5-02 BLOCKER (vẫn open)
- ACCESS_REFUSED khi connect RabbitMQ local
- Root cause: bind mount `docker/rabbitmq/data/` chứa mnesia DB cũ
- 3 integration test @skip với reason rõ ràng
- Đã quyết định: PARTIAL DONE, defer fix infra
- Fix candidates:
  * Đổi sang named volume trong docker-compose.yml
  * Hoặc wipe Docker Desktop reset toàn bộ
- ETA: khi resume infra task (không cản P6/P8)

## Technical debt mở
- **WAIVER T-P6-A** (sẽ dọn trong T-P6-B):
  - patient/get_summary.py và scheduling/find_oncall.py hiện gọi asyncpg pool TRỰC TIẾP
  - Phải refactor → gọi qua patient_service.get_summary_data() và scheduling_service.get_oncall_staff()
  - T-P6-B đã embed bước này

## T-P6-B TASK PACKET — SẴN SÀNG PASTE
Đã chuẩn bị task packet đầy đủ trong session chat trước đó.
Khái quát nội dung:
- Phần 1: Refactor waiver (patient_service.get_summary_data() + scheduling_service.get_oncall_staff())
- Phần 2: 4 tools mới
  * kb/read_policy.py (handle UndefinedTableError → rule_data=None)
  * communication/send_zalo.py (STUB, delivered=False)
  * lab/classify.py (STUB, classification="PENDING")
  * task/create.py + task_service.py skeleton (no DB write)
- Phần 3: 14 unit tests (kb 3 + comm 3 + lab 3 + task 3 + service tests 2)
- Phần 4: FastAPI router /v1/tools/* mount 6 endpoints cho OpenAPI doc
- Expected sau commit: 164 passed + 3 skipped

## Roadmap sau T-P6-B
```
T-P5-04   trace_id propagation end-to-end (small, làm cùng P8)
T-P5-07   Integration test event flow (small, làm cùng P8)
P6 done   → Tag commit hoặc merge PR feature/p4-p5-bundle vào main
P7        Dashboard Next.js — có thể skip, defer Phase 2
P8        LangGraph Orchestrator skeleton ← PRIORITY NEXT sau P6
P9.1-9.6  Sub-graphs theo thứ tự (Communication → Scheduling → Task → Lab → Pre-visit → StaffCap)
```

## Blockers chiến lược (chờ Anh Quang)
- H-1: v6 schema 35 entities — confirm cuối
- H-8: Qwen3-14B Mac Mini vs VPS — hosting decision
- Q-30: 1 BN book 2 appt cùng giờ khác BS — business rule
- Q-31: doctor-not-on-duty status code 409 vs 422 — chờ FE feedback

## Workflow rules (đã chốt)
1. Mỗi Task Packet PHẢI bắt đầu bằng "BƯỚC 0: COMMIT WORK CŨ"
2. Tuyền paste output task → tôi verify → cấp Task Packet tiếp theo
3. Báo % context window cuối mỗi response của tôi
4. Format Task Packet: SCOPE + BOUNDARY + CONTEXT + ACCEPTANCE + OUTPUT + NẾU GẶP VẤN ĐỀ
5. Antigravity hoặc Claude Code = executor; tôi (Claude Chat) = planner/architect

## Lưu ý cho session sau
- Mở file này đầu session, xác nhận `git log --oneline -3` khớp với "Last commits" ở trên
- Verify pytest còn 150 passed + 3 skipped trước khi paste T-P6-B
- Nếu Anh Quang chưa review PR: tiếp tục feature branch, không merge main
- Có thể tạo branch mới `feature/p6-tools` từ `feature/p4-p5-bundle` nếu muốn tách scope, hoặc tiếp tục trên cùng branch (recommend cùng branch cho tới P6 done)
- Docker bind mount issue (T-P5-02): defer, không cản P6/P8
- Xóa dòng `version:` trong docker-compose.yml (obsolete warning) — tiện thì làm trong commit nào đó
- pytest warning asyncio_default_fixture_loop_scope: thêm vào pyproject.toml nếu chưa
