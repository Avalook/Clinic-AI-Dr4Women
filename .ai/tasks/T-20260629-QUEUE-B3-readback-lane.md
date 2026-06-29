# T-20260629-QUEUE-B3 — Làn "Chờ đọc kết quả (B3)" + đồng bộ thứ tự board bác sĩ

## Bối cảnh / nghẽn
Nghẽn thứ tự 1 buổi nằm ở **vòng quay lại B3** (BS Thành re-entrant: B1 hỏi bệnh → B2
siêu âm/XN → B3 đọc KQ ~5'). Hệ KHÔNG biết "BN nào đã có KQ, đang chờ đọc" để chen lên
trước → Thành gọi BN-B1 mới trong khi BN-B3 (nhanh) ngồi chờ. Xem [[bottleneck-thanh-fragment-model]].

## Khảo sát (read-only, đã làm)
- Tín hiệu "B2 xong" ĐÃ có dữ liệu, CHƯA được tổng hợp/đưa lên thứ tự gọi:
  - **Lab**: `lab_result.visit_id` (nối ĐÚNG lượt) + `result_received_at` + có result ⇒ "lab xong".
    PENDING/`triage_group` = chưa. → đường sạch.
  - **Sono/Dịch vụ**: `service_log.status` DONE, NHƯNG `service_log` **không có `visit_id`**
    (chỉ `clinic_patient_id` + `service_type_id`) → nối về lượt hôm nay phải match BN + ngày.
- Grep "chờ đọc / ready for doctor / B3" = **RỖNG** → chưa có bất kỳ surface/flag B3-ready.
- visit giữ `IN_PROGRESS` suốt; appointment giữ `CHECKED_IN` tới khi BS "complete" → KHÔNG có
  state re-entry. `/queue` gom hết IN_PROGRESS vào nhóm "Đang khám" (lẫn: đang khám / đang ở
  sono / đã quay lại chờ đọc).
- Board bác sĩ thật (`DoctorWorkBoard`) xếp bằng `compareQueue` (số vé) — chưa dùng `callRank`.

## 4 câu khảo sát — trả lời
1. **B3-ready lấy từ đâu?** `lab_result` (visit_id, có result) + `service_log` (status DONE,
   match theo BN+ngày). Suy ra, KHÔNG cần cột mới.
2. **Đã có khái niệm B3-ready trong service_log/lab_result chưa?** Chưa. Chỉ có "xong" ở mức
   từng item; không roll-up "BN sẵn sàng đọc" và không đưa lên board bác sĩ.
3. **B1→B3 re-entry hiện diễn ra sao?** Không thành state — BN tự quay lại, nhân viên tự nhìn
   /lab-queue /sono. Không có gì bơm BN lên thứ tự gọi của bác sĩ.
4. **Mô hình B3-ready:** với mỗi visit IN_PROGRESS hôm nay, tính: có ≥1 chỉ định B2 đã xong
   và KHÔNG còn chỉ định B2 treo → "Chờ đọc KQ" → đưa thành 1 LÀN ưu tiên.

## Đề xuất (chờ Quang DUYỆT trước khi code)
- **Cách A (khuyến nghị, KHÔNG migration):** derive thuần ở read-side.
  - `/queue`: thêm làn **"🔔 Chờ đọc KQ (B3)"** trên cùng (trước cả tầng "có hẹn"), gồm BN
    visit IN_PROGRESS có KQ B2 xong. Badge mỗi dòng. (Mở rộng `callRank`/thêm tier −2.)
  - Đồng bộ `DoctorWorkBoard` (+ tasks/page.tsx fetch) sang `callRank` + cùng làn B3.
- **Cách C (defer):** thêm cột/timestamp `visit.awaiting_readback_at` (chính xác hơn nhưng cần
  migration + đường ghi) — chỉ làm nếu derive không đủ chính xác do service_log thiếu visit_id.

## Trả lời các câu Quang hỏi
- **Migration?** Cách A: **KHÔNG** (thuần derive từ bảng sẵn có). Chỉ Cách C mới cần.
- **File đụng:** `lib/queue.ts` (logic làn B3 + tier), `queue/page.tsx` + `QueueBoard.tsx`
  (fetch lab_result/service_log cho các visit hôm nay + render làn), tuỳ chọn
  `tasks/page.tsx` + `DoctorWorkBoard.tsx`.
- **Rủi ro prod:** THẤP — read-only, không đổi schema, không đường ghi. Sai cùng lắm là xếp
  nhầm hiển thị; fail-safe: thiếu dữ liệu → BN nằm làn thường như cũ.
- **Test:** tsc/lint/build; tay: BN xong B1 → đánh dấu lab/sono xong → hiện làn "Chờ đọc";
  khi còn chỉ định treo thì CHƯA hiện.

## Điểm cần chốt khi code (đã nhận diện)
- `service_log` thiếu `visit_id`: match B2-sono về lượt hôm nay theo `clinic_patient_id` +
  cửa sổ ngày. Nếu nhiễu → Phase 1 chỉ tính **lab** (visit_id sạch), sono thêm sau.
