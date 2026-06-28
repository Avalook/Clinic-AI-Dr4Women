# Decision Doc + Task Packet — T-20260629-CAP-01: Engine ngân sách tải + newCap (Phase 1)

> Loại: **DECISION DOC** (cần Quang ký mục §2 trước) **+** Task Packet (Claude Code chạy sau khi ký).
> Người soạn: Claude Code, theo phiên bàn với Quang. Ngày: 2026-06-29. **Bản v2** (vá 9 điểm review).
> Trạng thái: ⏸ **CHỜ DUYỆT** — chưa được code/migrate gì cho tới khi §2 có chữ ký.
> v2 chốt thêm: location vào ngân sách (#1), tách `lib/capacity.ts` + timezone VN (#2), `full_total` (#6), unique index chống trùng config (#7), race=best-effort+net 6-overlap (#8), fail-open khi thiếu config (#8b), COALESCE tải NULL cho ca cũ (#9).

---

## 0. VÌ SAO CÓ DOC NÀY (1 đoạn)

Bàn thiết kế đặt lịch nảy ra mô hình "ngân sách phút-Thành/khung + trần ca mới (newCap) + tách quota online/walk-in/buffer", thay cho cách hiện tại "tối đa 6 ca chồng/bác sĩ". Khi khảo sát code thật mới thấy mô hình mới **va 4 quyết định đã khoá** → theo CLAUDE.md §3 ("không chắc → STOP, hỏi Planner") phải để Quang chốt trước, không tự sửa.

**Đính chính quan trọng:** vấn đề `FRAGMENT`/`findRun`/ô-liền-kề **chỉ tồn tại ở prototype `datlich-rapchieu/`**, KHÔNG có trong production. Production `chinh` đã window-based (`slot_start`/`slot_end`). → **Không port prototype.** Việc thật của Phase 1 chỉ là thêm *ngân sách + phân loại tải*, không phải gỡ FRAGMENT.

---

## 1. HIỆN TRẠNG (đã khảo sát — khỏi dò lại)

- `appointment` (cột thật): `id, clinic_patient_id, doctor_id, service_type_id, location_id, slot_start, slot_end, booking_channel, queue_number, status, cancelled_at, cancellation_reason`. Slot = window `[slot_start, slot_end)` ISO UTC (VN = +7).
- **Capacity duy nhất hiện có:** exclusion constraint DB `appointment_no_doctor_overlap` ⇒ ép **≤ 6 ca chồng/bác sĩ/khung** (`api/appointments/route.ts` ~dòng 50–96 client-check + DB constraint). KHÔNG có khái niệm phút-tải, KHÔNG phân biệt mới/tái, KHÔNG quota kênh.
- `visit`: `OPEN → IN_PROGRESS → FINALIZED`; đã có `exam_completed_at` (migration 058) ⇒ **nền đo "thời gian khám thực tế" đã sẵn** — đây là vốn để hiệu chỉnh con số sau 2–4 tuần.
- Siêu âm: `service_log kind='SA'`, **tách rời hoàn toàn** appointment (D025: SA không có slot riêng).
- `lib/queue.ts` `callRank()`: 3 lớp (VIP `ƯT` / đặt-đúng-giờ / walk-in+trễ, cửa trễ 10'). **Không đụng ở Phase 1.**
- Migration mới nhất: `060`. Kế tiếp = **061**. Mẫu: idempotent, `BEGIN/COMMIT`, `COMMENT ON`, có file `.down.sql`.

---

## 2. QUYẾT ĐỊNH CẦN QUANG KÝ (mỗi dòng ✅/❌/sửa)

| # | Quyết định | Đề xuất | Ký |
|---|---|---|---|
| **DEC-1** | Giữ constraint `appointment_no_doctor_overlap` (6-cap) làm **safety net**, ngân sách chạy ở **tầng application** phía trên. KHÔNG drop constraint ở Phase 1. | ✅ Giữ | ☐ |
| **DEC-2** | Đặt logic ngân sách **tạm trong `api/appointments/route.ts`** (Phase 1), đánh dấu `// TODO[D017]` để sau dời vào LangGraph Scheduling sub-graph. Chấp nhận "nợ kiến trúc" có chủ đích. | ✅ Tạm ở route, có TODO | ☐ |
| **DEC-3** | `patient_kind` (NEW/RETURN) + `thanh_min` + `sono_min` + `need_sono` **do CSKH nhập/xác nhận tay**, KHÔNG auto-suy từ phút slot (tôn trọng chốt 26/6 "bỏ auto-ƯT-theo-phút"). Hệ thống chỉ *gợi ý* mặc định theo dịch vụ. | ✅ CSKH nhập tay | ☐ |
| **DEC-4** | Migration `061` chỉ **additive** (ADD COLUMN nullable + bảng config mới). Không sửa/không bỏ cột cũ, không đụng constraint. | ✅ Additive-only | ☐ |
| **DEC-5** | Con số ngân sách khởi điểm (§4 bảng seed) là **ước lượng để chạy**, sẽ hiệu chỉnh từ `visit.exam_completed_at − checked_in_at` sau 2–4 tuần. Không coi là chân lý. | ✅ Seed tạm, đo lại | ☐ |
| **DEC-6** | Phase 1 **chưa** làm lớp 2 (visit steps B1/B2/B3) và **chưa** coupling siêu âm. Chỉ làm van lớp 1 + hiển thị trạng thái ô. | ✅ Hoãn lớp 2 sang Phase 2 | ☐ |
| **DEC-7** | **Race condition (V2#8):** check ngân sách ở application là *best-effort* — 2 request đồng thời có thể cùng lọt (TOCTOU). Phase 1 chấp nhận, dựa **6-overlap** chặn vỡ thô; fix triệt để (RPC/transaction + `pg_advisory_xact_lock` theo khung) để **Phase 1.5**. Ghi rõ là known-limit. | ✅ Best-effort + net 6-overlap, hoãn lock | ☐ |
| **DEC-8** | **Thiếu config (V2#8b):** khi không có dòng `block_budget` khớp → **fail-open + cảnh báo** (cho đặt, chỉ còn 6-overlap), KHÔNG chặn phòng khám vì thiếu seed. Resolve theo thứ tự: (cơ sở,BS,thứ,giờ) → (cơ sở,BS,—,giờ) → (cơ sở,—,—,giờ) → fail-open. | ✅ Fail-open + log | ☐ |

> Nếu DEC-2 = ❌ (muốn làm chuẩn LangGraph ngay) → Phase 1 đổi scope lớn, cần task riêng cho graph. Báo lại.
> Nếu DEC-7 = ❌ (muốn an toàn tuyệt đối ngay) → kéo phần RPC+advisory-lock vào Phase 1, scope +1 ngày.

---

## 3. MIGRATION ĐỀ XUẤT (dán review — CHƯA tạo file `.sql`)

`src/migrations/20260629_061_capacity_budget.sql` (dự kiến):

```sql
BEGIN;

-- Phase 1 capacity: phân loại tải/ca + bảng ngân sách khung. Additive-only (DEC-4).
-- Liên quan D027 (appointment≠visit), D017 (sau dời logic sang Scheduling graph).

-- 3.1 Thêm tải/ca vào appointment (CSKH nhập tay — DEC-3, không auto-suy).
ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS patient_kind text
    CHECK (patient_kind IN ('NEW','RETURN')),
  ADD COLUMN IF NOT EXISTS thanh_min int CHECK (thanh_min BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS sono_min  int CHECK (sono_min  BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS need_sono boolean;

COMMENT ON COLUMN appointment.patient_kind IS
  'NEW=khám lần đầu, RETURN=tái khám. CSKH chọn tay. Quyết định tải Thành/sono.';
COMMENT ON COLUMN appointment.thanh_min IS
  'Phút BS Thành dự kiến (B1+B3 cộng lại). CSKH xác nhận, mặc định gợi theo dịch vụ.';
COMMENT ON COLUMN appointment.sono_min IS 'Phút chiếm trạm siêu âm. 0 nếu không cần.';
COMMENT ON COLUMN appointment.need_sono IS 'Có đi siêu âm không.';

-- 3.2 Bảng cấu hình ngân sách theo CƠ SỞ × bác sĩ × thứ × khung-giờ (DEC-5).
-- location_id BẮT BUỘC (V2#1): Kim Ngưu vs Nam Đồng khác phòng/khác trạm SA.
CREATE TABLE IF NOT EXISTS block_budget (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES clinic_location(id),
  doctor_id     uuid REFERENCES staff(id),     -- NULL = default cho mọi BS tại cơ sở
  weekday       int  CHECK (weekday BETWEEN 0 AND 6),  -- 0=CN..6=T7; NULL=mọi ngày
  hour_start    int  NOT NULL CHECK (hour_start BETWEEN 0 AND 23), -- khung [hour_start, hour_start+1) GIỜ VN
  thanh_budget_min int NOT NULL DEFAULT 50,
  sono_budget_min  int NOT NULL DEFAULT 90,    -- 2 trạm; coupling thật để Phase 2
  online_quota_min int NOT NULL DEFAULT 35,
  walkin_quota_min int NOT NULL DEFAULT 10,
  buffer_min       int NOT NULL DEFAULT 5,
  new_cap          int NOT NULL DEFAULT 3,     -- trần SỐ ca mới/khung (đòn phanh chính)
  max_total        int NOT NULL DEFAULT 12,    -- giữ điều kiện PK "tối đa 12 ca/giờ"
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE block_budget IS
  'Ngân sách tải/khung-giờ theo cơ sở. Seed ước lượng, hiệu chỉnh từ visit.exam_completed_at.';

-- V2#7: chống trùng cấu hình. NULL trong unique không tự loại nhau ⇒ dùng COALESCE
-- (doctor_id NULL→zero-uuid, weekday NULL→9) để 1 (cơ sở,BS,thứ,giờ) chỉ có 1 dòng.
CREATE UNIQUE INDEX IF NOT EXISTS uq_block_budget_key ON block_budget (
  location_id,
  COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(weekday, 9),
  hour_start
);

COMMIT;

-- SAU MIGRATION (bắt buộc, nếu không màn trống dù data còn): NOTIFY pgrst, 'reload schema';
```

`...061_capacity_budget.down.sql`:
```sql
BEGIN;
DROP TABLE IF EXISTS block_budget;
ALTER TABLE appointment
  DROP COLUMN IF EXISTS patient_kind, DROP COLUMN IF EXISTS thanh_min,
  DROP COLUMN IF EXISTS sono_min,    DROP COLUMN IF EXISTS need_sono;
COMMIT;
```

---

## 4. SEED NGÂN SÁCH KHỞI ĐIỂM (BS Thành — DEC-5, sẽ chỉnh)

Mặc định tải/ca (CSKH có thể sửa từng ca):

| patient_kind / dịch vụ | thanh_min | sono_min | need_sono |
|---|--:|--:|---|
| RETURN nhanh (không SA) | 5 | 0 | ✗ |
| RETURN có SA | 7 | 8 | ✓ |
| NEW thường | 15 | 12 | ✓ |
| NEW phức tạp | 20 | 15 | ✓ |

Ngân sách theo khung (BS Thành, tối T2–T6):

| hour_start | thanh_budget | new_cap | max_total | ghi chú |
|--:|--:|--:|--:|---|
| 17 | 40 | 2 | 8 | đầu buổi |
| 18 | 50 | 2 | 10 | |
| 19 | 55 | 3 | 12 | cao điểm |
| 20 | 55 | 3 | 12 | cao điểm |
| 21 | 45 | 2 | 9 | giảm tải |
| 22 | 30 | 1 | 6 | buffer/đọc KQ |

> Phép tính kiểm chứng: 1 ca NEW ≈ 15' Thành = "ăn" chỗ ~3 ca RETURN. Trần 55 BN/buổi chỉ đạt khi tái khám áp đảo ⇒ `new_cap` là cái phải có, không chỉ `max_total`.

---

## 5. CODE — SCOPE PHASE 1 (sau khi §2 ký)

### In-scope
- **`lib/capacity.ts`** mới (V2#2 — KHÔNG nhét vào `lib/queue.ts`; queue.ts chỉ lo `callRank` thứ tự gọi). Helper thuần, không I/O, để Phase 2/LangGraph (D017) tái dùng:
  - `blockOf(slotStart)`: trả `{location_id, doctor_id, weekday, hour_start}` — **giờ/thứ tính theo `Asia/Ho_Chi_Minh`, KHÔNG `getUTCHours()`** (V2#2 timezone). Dùng lại helper VN-offset có sẵn (`lib/roster.ts`).
  - `loadOfAppt(appt)`: `thanh_min` của ca; **COALESCE NULL → mặc định bảo thủ 12'** (V2#9) để các appointment cũ chưa có tải KHÔNG bị tính = 0 làm tràn khung. Tương tự `patient_kind` NULL → coi như NEW (an toàn hơn).
  - `resolveBudget(blockRows, key)`: chọn dòng theo thứ tự DEC-8; trả `null` ⇒ caller fail-open.
  - `budgetState(budget, apptsInBlock, candidate)`: trả `{status, reason, used:{thanh, online, walkin, new_count, total}}`.
- **`api/appointments/route.ts`** (POST + endpoint `quote`): từ `slot_start` + `location_id` + `doctor_id` lấy `block_budget` khớp, cộng `loadOfAppt` các appointment cùng cơ sở+khung+bác sĩ (status chưa huỷ), kiểm tuần tự:
  1. `count+1 > max_total` → `full_total` (V2#6 — giữ điều kiện "≤12 ca/giờ")
  2. `patient_kind='NEW'` & (đếm NEW)+1 > `new_cap` → `full_new`
  3. **kênh** (V2#5): `booking_channel='WALK_IN'` → quota walk-in; còn lại (đặt trước/CSKH) → quota online. `online_used + thanh_min > online_quota` → `full_online` (lễ tân/walk-in vẫn đặt được phần quota riêng); walk-in vượt `walkin_quota` nhưng còn `buffer_min` → `warning_buffer`.
  4. `thanh_used + thanh_min > thanh_budget` → `full_thanh`
  5. `need_sono` & sono khung cao → **chỉ cảnh báo** (chặn sono để Phase 2)
  6. còn nhưng sát ngưỡng → đặt được + `warning`
  - Trả JSON `{status, reason, used}` cho UI tooltip. **Giữ** check 6-overlap cũ làm chốt chặn cuối (DEC-1, DEC-7). Đánh dấu `// TODO[D017]` + `// TODO[Phase1.5: advisory lock]`.
- **`CinemaSlotPicker.tsx`**: trạng thái ô `Trống · Còn ít · Chỉ tái khám · Đầy-Thành · Giữ vãng lai · Khoá`; tooltip `thanh_used/budget`, `new_count/new_cap`, `online_used/quota`. Cùng ô, CSKH vs lễ tân nhìn quota khác nhau.
- **`AppointmentBooking.tsx` / `NewPatientForm.tsx`**: thêm field `patient_kind` + `need_sono`; auto-gợi `thanh_min/sono_min` theo §4 nhưng **cho sửa** (DEC-3).

### Out-of-scope (Phase 2+)
- Visit steps B1/B2/B3 tái nhập, tháp điều phối, coupling siêu âm thật, dời logic vào LangGraph (D017), RPC+advisory-lock (Phase 1.5, DEC-7). KHÔNG đụng `callRank()`, `service_log`, `sono`.

---

## 6. RÀNG BUỘC THỰC THI
- Chỉ nhánh `chinh`. Commit **local**, **KHÔNG push** tới khi Quang "OK".
- DB: migration 061 — Claude apply vào **fzw (dev)** để test; **atf (prod) Quang tự paste** + `NOTIFY pgrst,'reload schema'` (memory `two-supabase-prod-sync`, `postgrest-reload-after-ddl`).
- KHÔNG `git add -A` (tránh dính file Quang đang code song song).

## 7. VERIFY (từ `src/dashboard`)
```
npx tsc --noEmit && npm run lint && npm run build
```
App: đặt 3 ca NEW vào 1 khung → ca thứ 4 bị `full_new` dù chưa tới 6 ca; đặt 6 ca RETURN ngắn vẫn nhận; lễ tân đặt được khi online đầy mà walk-in còn.

## 8. AC
- [ ] §2 đủ chữ ký.
- [ ] Migration 061 applied fzw, SQL atf giao Quang.
- [ ] `new_cap` chặn đúng; quota online/walk-in tách đúng; 6-overlap vẫn còn.
- [ ] tsc/lint/build sạch. Commit local. Cập nhật `context/CURRENT_PROGRESS.md`.

## 9. K1 — Giả định (đã tra, còn 1 mục chờ)
- ✓ Bảng cơ sở = `clinic_location` (migration 001). FK `block_budget.location_id` → `clinic_location(id)`.
- ✓ Kênh: `booking_channel='WALK_IN'` = lễ tân/vãng lai; còn lại = đặt trước/online (route.ts:192–205). Có bảng lookup `booking_channel` (migration 026, có cột `category`) — Phase 1 chỉ phân nhánh `=WALK_IN`.
- ✓ `staff(id)` là FK đúng cho `doctor_id`.
- ⏳ **Chờ:** có bảng `service_type` mang cột thời lượng/tải mặc định không? Nếu **không** → Phase 1 hard-code map dịch vụ→`{thanh_min,sono_min}` tạm trong `lib/capacity.ts` + `// TODO`. (route.ts dùng `service_type_id`.)

## 10. SEED BẮT BUỘC khi migrate (tránh fail-open thành mặc định)
- Seed tối thiểu **dòng default cấp cơ sở** (`doctor_id=NULL, weekday=NULL`) cho mỗi `hour_start` ở **mỗi `clinic_location`** đang hoạt động, theo §4. Có default rồi thì DEC-8 fail-open chỉ kích khi cấu hình hổng thật sự, không phải mọi ca.
- Seed dòng riêng BS Thành (`doctor_id=<Thành>`) theo bảng §4 — override default.
