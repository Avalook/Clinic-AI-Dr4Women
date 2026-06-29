# T-20260629-EPI-01 — "Đợt khám" (care_episode) + luồng tái khám/khám-mới tự suy

## Bối cảnh / nỗi đau
CSKH phải bấm tay "khám mới / tái khám" — vừa thừa (dedup đã biết ai là BN cũ) vừa
dễ sai (cùng dịch vụ nhưng đợt bệnh mới vẫn bị tính RETURN → đếm thiếu tải BS Thành →
overbook). `patient_kind` là **proxy tải Thành** (NEW 15' / RETURN 5'), gắn với *đường
dịch vụ × đợt bệnh*, KHÔNG phải "đã từng tới chưa". Xem [[capacity-budget-patient-kind]],
[[bottleneck-thanh-fragment-model]].

## Quyết định (Quang chốt qua hội thoại 29/6)
- **DEC-E1** Tách 2 trục: danh tính (dedup lo, bỏ nút "khách mới/cũ") vs tải (NEW/RETURN).
- **DEC-E2** Thêm lớp **đợt khám** (BN × dịch vụ): OPEN / PENDING_CLOSE / CLOSED.
  Mỗi (BN, dịch vụ) tối đa 1 đợt còn sống (partial unique index).
- **DEC-E3** Suy NEW/RETURN từ trạng thái đợt → làm **mặc định thông minh**, CSKH sửa được.
  Đợt OPEN → mặc định RETURN. Không có đợt sống → mặc định NEW (hướng sai an toàn = đếm
  thừa tải, không overbook).
- **DEC-E4** Chốt đợt đến từ **bác sĩ**: khám xong KHÔNG hẹn lần sau (không có lịch tương
  lai cùng dịch vụ) → đợt sang PENDING_CLOSE. CSKH **xác nhận** → CLOSED (lưới an toàn
  chống BS quên hẹn). [UI xác nhận = slice sau.]
- **DEC-E5** Khách MỚI (NewPatientForm): luôn NEW, **ẩn nút Loại khám**.
- **DEC-E6** BN cũ: KHÔNG dựng form mới — tái dùng trang chi tiết BN (admin read-only +
  "Sửa thông tin" có audit `event_log` + đặt lịch bên dưới). Chỉ bồi: hint số lần đã khám
  dịch vụ này + trạng thái đợt + default + nhãn ý nghĩa.
- **DEC-E7** DB đưa SQL cho Quang chạy tay trên **atf prod** (KHÔNG sync fzw→atf). Em chỉ
  viết migration + code; KHÔNG tự apply. Xem [[two-supabase-prod-sync-workflow]].

## Phạm vi slice này (ĐÃ làm)
1. `src/migrations/20260629_063_care_episode.sql` — bảng + `appointment.episode_id`.
2. `api/appointments` POST: mở/đóng/gắn đợt theo `patient_kind` (best-effort, fail-open).
3. `api/appointments` PATCH `complete`: đợt → PENDING_CLOSE nếu không có lịch tương lai
   cùng dịch vụ.
4. `api/appointments/service-history` GET: count lượt + đợt sống cho hint.
5. `AppointmentBooking.tsx`: hint + default + nhãn ý nghĩa.
6. `NewPatientForm.tsx`: ẩn 2 select Loại khám (giữ NEW).
7. `api/patients` PATCH: bồi before/after vào `event_log` (lưu trường đổi).

## Slice 2 (ĐÃ làm) — CSKH xác nhận đóng đợt
- `api/episodes` PATCH {close|reopen} (gate canManageAppt, chỉ từ PENDING_CLOSE, race-guard, logEvent).
- Trang `/episodes` (`page.tsx` + `EpisodesBoard.tsx`): liệt kê PENDING_CLOSE + nút "Xác nhận
  đóng" / "Còn theo dõi". Nav + NAV_ROLES [CSKH, MANAGEMENT, TRUONG_CA]. Verify tsc/build/lint ✓.

## Treo (slice sau)
- Auto-đóng đợt im > N tuần (8 tuần phụ khoa; khám thai theo lịch thai, KHÔNG cứng tuần).
  Cần scheduler (Supabase cron / pg_cron) — app chưa có cron in-app. Hiện chưa gấp: đợt im
  vẫn OPEN → đặt lịch lại mặc định RETURN, nhưng CSKH thấy hint "đã khám N lần · lượt gần
  nhất <ngày>" để tự sửa sang Khám mới.

## Verify
- `cd src/dashboard && npx tsc --noEmit && npm run build`.
- Sau khi Quang chạy 063 + `NOTIFY pgrst,'reload schema'` trên atf: đặt lịch BN cũ cùng
  dịch vụ lần 2 → thấy hint "đã khám N lần", default RETURN; chọn dịch vụ mới → default NEW.
