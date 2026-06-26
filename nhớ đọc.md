# 🔖 NHỚ ĐỌC — mình vừa làm gì (phiên 2026-06-26 tối)

> File nhắc nhanh. Chi tiết đầy đủ + lý do luôn ở `context/CURRENT_PROGRESS.md` (mục trên cùng).

## Vừa làm: THỨ TỰ GỌI KHÁM ưu tiên (Model ②) + trang lẻ `/queue`

**Nỗi đau đã fix:** số vé (queue_number) cấp lúc ĐẾN nên KHÔNG thể là thứ tự gọi.
Người hẹn 9:00 đến 9:03 từng bị thua 2 khách vãng lai đến 9:00 (tự check-in, có vé trước).

**Cách giải — tách số vé (chỉ định danh) khỏi thứ tự GỌI; gọi theo TÊN:**
1. **`lib/queue.ts` → `callRank()`** xếp 3 tầng:
   - tầng −1: **ƯT** (người quen nhà bác sĩ, gõ tay)
   - tầng 0: **có hẹn đến đúng giờ** (check-in ≤ giờ hẹn + **10 phút**) → xếp theo GIỜ HẸN
   - tầng 1: **vãng lai / đến trễ** → xếp theo GIỜ ĐẾN
   - `compareQueue` dùng `callRank` cho hàng đã check-in, thiếu field thì fallback luật cũ (tương thích ngược).
2. **Trang mới `/queue`** (`app/(dashboard)/queue/page.tsx` + `QueueBoard.tsx`):
   gom theo bác sĩ · gọi theo TÊN · tách "Đang khám" · nhãn Có hẹn/Vãng lai · tự refresh 30s · chỉ-đọc.
   Đã thêm vào sidebar (`nav-items.ts`) + quyền (`lib/roles.ts` NAV_ROLES).
3. **Đồng bộ board cũ:** thêm `booking_channel` + `visit.checked_in_at` vào HomeCheckin (trang chủ) và DoctorWorkBoard (Công việc của tôi) để xếp cùng luật.

**KHÔNG đụng DB** — dùng cột có sẵn, không migration.

## Cách xem
- Đăng nhập (CSKH / Lễ tân / Quản lý / Bác sĩ…) → sidebar mục **"Số thứ tự gọi khám"** (`/queue`).

## 🗺️ Sửa ở đâu nếu cần đổi tiếp
| Muốn đổi | File | Điểm |
|---|---|---|
| Luật xếp gọi / cửa sổ trễ | `src/dashboard/lib/queue.ts` | `callRank()` + `LATE_GRACE_MS` (10') |
| Giao diện bảng gọi | `app/(dashboard)/queue/QueueBoard.tsx` | client, refresh 30s |
| Dữ liệu bảng gọi | `app/(dashboard)/queue/page.tsx` | SELECT + lọc CHECKED_IN hôm nay |
| Ai thấy menu | `lib/roles.ts` NAV_ROLES + `nav-items.ts` | |
| Board /home & "Việc của tôi" | `home/page.tsx`, `tasks/page.tsx`, `tasks/DoctorWorkBoard.tsx` | đều dùng `compareQueue` |

## Còn treo / cần lưu ý
- Cửa sổ trễ đang để cứng **10'** trong `lib/queue.ts` (`LATE_GRACE_MS`). Muốn đổi thì sửa 1 chỗ đó.
- Trang `/queue` chỉ hiển thị + tự refresh, CHƯA có nút "đã gọi / bỏ qua". Nếu cần thao tác thì làm thêm sau.
- `WeeklyAppointmentsTable` (overview tuần) cố ý để fallback, không gắn 2 field mới.

— Commit liên quan: `feat(queue): thứ tự GỌI khám ưu tiên người có hẹn (Model ②) + trang lẻ /queue`
