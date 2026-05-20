# CURRENT_PROGRESS.md
_Cập nhật: cuối session P9.1-03 DONE. Handoff cho session mai (T-P9.1-03b)._
_Tag mới nhất: v0.8.0-orchestrator (P8 done). P9.1 in progress._

## Phase tổng quan
P1-P6                       ✅ DONE
P8 Orchestrator             ✅ DONE (v0.8.0-orchestrator)
P9.1 Scheduling sub-graph   🟡 IN PROGRESS
  T-P9.1-01 skeleton        ✅ e37bbea
  T-P9.1-02 slot-filling    ✅ 6dc6043
  T-P9.1-03 wire find_oncall✅ e3693fa (tool semantic MISMATCH — xem dưới)
  T-P9.1-03b NEW tools      ⏭ NEXT — find_work_sessions + appointment CRUD tools
  T-P9.1-04 orchestrator    ⏳ sau 03b
P9.2-P9.5 sub-graphs        ⏳

## Test count: 228 passed + 6 skipped
scheduling tests: 30 passed (24 conversation + 6 tool integration)

## Stack confirmed (KHÔNG ĐỔI)
- Models: MAIN_BRAIN=claude-sonnet-4-6, GATEWAY=claude-haiku-4-5-20251001
- LangGraph 0.6.11 + checkpointer Postgres async
- Anthropic 0.52.0 + tenacity 9.1.4

## Git state
Branch: feature/p8-orchestrator (pushed, clean)
Last 5 commits:
  e3693fa T-P9.1-03 wire find_oncall_staff (semantic mismatch — see notes)
  6dc6043 T-P9.1-02 slot-filling conversation
  e37bbea T-P9.1-01 skeleton sub-graph
  839506e docs(worklog): close P8
  4cca306 T-P8-06 conditional routing + 5 stubs

Main = 4f7cd62 (P3) — nợ merge p4-p5-bundle + p8-orchestrator + p9.1

## 🚨 VẤN ĐỀ KIẾN TRÚC P9.1-03 (cần xử lý đầu session mai)

`find_oncall_staff(work_session_id, ctx)` KHÔNG phù hợp use case "đặt lịch tương lai".
Đó là tool tra cứu nhân sự đang trực CỦA 1 SESSION ĐÃ TỒN TẠI.
P9.1-03 hiện đang dùng `work_session_id=uuid4()` placeholder → production sẽ query session
không tồn tại → trả empty.

Code P9.1-03 KHÔNG bỏ — closure factory pattern + 3-layer fallback + pool injection
vẫn dùng lại nguyên cho tool mới. Chỉ phần body `find_doctor_node` sẽ rewire sang tool mới.

## Schema Supabase (verified từ src/migrations/)

### work_session (migration 009)
- id (UUID PK)
- location_id (FK clinic_location)
- session_date (DATE)
- session_type (CHECK: EVENING / WEEKEND_MORNING / WEEKEND_AFTERNOON)
- start_time, end_time (TIME)
- max_patients (INT nullable)
- UNIQUE (location_id, session_date, session_type)

⚠ session_type không có "MORNING/AFTERNOON" cho weekday → cần translation:
- weekday + sáng/chiều → ??? (chưa có session_type tương ứng)
- weekday + tối → EVENING
- weekend + sáng → WEEKEND_MORNING
- weekend + chiều → WEEKEND_AFTERNOON

DECISION cần trả lời session sau: weekday daytime có session_type riêng chưa,
hay chỉ có evening? Nếu chỉ có evening → user chọn weekday+sáng phải redirect.

### work_session_staff (migration 010)
junction table — ai trực session nào, role, on_call_flag, is_training

### appointment (migration 011)
- id, clinic_patient_id, doctor_id (nullable), work_session_id (nullable), location_id, service_type_id
- slot_start / slot_end (TIMESTAMPTZ)
- assigned_station, queue_number, booking_channel, is_priority_slot, is_walkin
- status: SCHEDULED / CONFIRMED / CHECKED_IN / COMPLETED / NO_SHOW / CANCELLED
- confirmed_at, cancelled_at, cancellation_reason

### appointment_slot_exclusion (migration 012) — SAFETY GATE
GIST constraint anti-double-book: cùng doctor_id + overlapping [slot_start, slot_end)
REJECTED ở DB level (trừ CANCELLED/NO_SHOW). CANON v6 Medical Safety Gate.

## Service layer hiện có (NOT tools yet)
SchedulingService methods:
- confirm_appointment(appointment_id) — SCHEDULED → CONFIRMED
- cancel_appointment(appointment_id, reason)
- (KHÔNG có create_appointment service method yet — cần thêm)

Tools/scheduling/ hiện có:
- find_oncall.py — find_oncall_staff (semantic = "ai đang trực session X")

## T-P9.1-03b SCOPE (NEXT — session mai)

Mục tiêu: implement đủ tools để sub-graph scheduling đặt lịch thật.

### Tools cần tạo:
1. **find_work_sessions(location_id, session_date, session_type)** → list[work_session]
   - Query bảng work_session
   - Input chuẩn TraceContext giống find_oncall.py
   - Translation layer trong sub-graph: morning/afternoon/evening + weekday → session_type

2. **create_appointment(patient_id, work_session_id, doctor_id, slot_start, slot_end, ...)**
   - Wrapper service method (cần tạo SchedulingService.create_appointment trước nếu chưa có)
   - Trả về appointment_id
   - DB GIST constraint sẽ reject auto nếu overlap → wrap exception thành VN message

3. **confirm_appointment_tool(appointment_id)** — wrap SchedulingService.confirm_appointment

4. **cancel_appointment_tool(appointment_id, reason)** — wrap SchedulingService.cancel_appointment

### Quyết định chờ Tuyền chốt đầu session mai:
- (Q1) Weekday daytime session_type: thêm migration 015 (MORNING/AFTERNOON cho weekday)
  hay chỉ support evening + weekend morning/afternoon? Đây là business decision —
  cần hỏi anh Quang/chị Thu trước khi code.
- (Q2) Tool location: tools/scheduling/{find_sessions,create_appt,confirm_appt,cancel_appt}.py
  riêng từng file, hay gộp tools/scheduling/booking.py? → suggest tách riêng (mỗi tool 1 file
  đồng nhất với find_oncall.py).
- (Q3) ScheduleService.create_appointment đã có chưa? Verify trước khi viết tool wrapper.

## T-P9.1-04 PREVIEW (sau 03b)
Wire scheduling sub-graph vào orchestrator:
- Thay scheduling_stub_node trong orchestrator/stubs.py bằng compiled sub-graph
- Pool injection: orchestrator service lifespan cần expose pool tới sub-graph factory
- E2E test: user "đặt lịch khám mai sáng" → flow 4 turn → appointment created
- Migrate stubs.py: scheduling_stub remove, 4 stub còn lại giữ
- Update test_routing.py: stub test scheduling case đổi assertion

## Workflow rules (vẫn áp dụng)
1. BƯỚC 0 Task Packet: verify git clean + pytest baseline
2. Tuyền paste output → Claude verify → packet tiếp
3. Test path: src/tests/... (NOT tests/...)
4. Worklog file: context/CURRENT_PROGRESS.md (NOT worklog/)

## Lưu ý session sau (mai)
1. Mở file này đầu session, paste vào Claude Chat
2. Verify `git log --oneline -1` = e3693fa (HOẶC commit handoff worklog mới hơn)
3. `poetry run pytest -q 2>&1 | tail -2` = 228 passed + 6 skipped
4. Trả lời 3 quyết định Q1/Q2/Q3 trên TRƯỚC khi nhận task packet
5. Branch hiện tại: feature/p8-orchestrator (KHÔNG đổi)

## Nợ kỹ thuật mở (không cản P9.1)
- Merge feature/p4-p5-bundle + feature/p8-orchestrator vào main (sau P9.1 done)
- RabbitMQ T-P5-02 bind mount
- Xóa `version:` docker-compose.yml
- Pytest asyncio_default_fixture_loop_scope config

## Critical reminders cho session mai
- KHÔNG dùng Sonnet 4 cũ (claude-sonnet-4-20250514 RETIRED)
- Tool path import THẬT: clinicai.tools.scheduling.find_oncall (cho monkeypatch)
- DB GIST constraint anti-double-book = Medical Safety Gate, KHÔNG override trong code
- Service layer phải tồn tại trước khi viết tool wrapper
