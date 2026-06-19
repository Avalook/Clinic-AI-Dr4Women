# HANDOFF WORKLOG — Dashboard Ver2 (phiên 19/6, đóng)

## TRẠNG THÁI
Dashboard Ver2: hoàn tất TOÀN BỘ phần code làm được mà không cần input người.
~42 commit LOCAL, CHƯA push. Branch: feat/t-transform-01.
Phần còn lại = CHỜ PK/Quang/BS (không phải nợ code).

---

## COMMIT PHIÊN NÀY (theo thứ tự)
- 82454db — Lễ tân: progress stepper + đồng hồ chờ đổi màu (WAIT_GREEN_MAX=10/YELLOW=20). 2 mốc cuối xám chờ billing.
- 0bff182 — CSKH: bảng nhắc gọi 4 bucket (FOLLOWUP_TIERS=[2,10,20,30]) + nút "Đã gọi" → cskh_followup. Bucket RỖNG tới khi BS điền tai_kham.ngay (đúng, không phải bug).
- 73d5ff6 — Cashier split: mig052, role CASHIER_THUOC + CASHIER_DV (2 login riêng), CASHIER cũ = superset.
- 871418b — Catalog: mig051, drug_catalog (64 thuốc) + service_price (29 DV), giá NULL (lazy-fill). Picker runtime /api/catalog + datalist, dùng chung 5 form. 3 needs_review.
- 11f02d3 — Bỏ nút BS "Nhận/Trả lịch" (luồng: Lễ tân check-in → BS khám thẳng) + tên BS đầy đủ (mig053 seed 17 BS) + 3 chỗ render short_name→full_name (roster/chip/picker).
- 8ba2a8e — TKYK enable: mở menu /tasks + /patient-list + vào form khám (clinical-record gate thêm isThuKyRole). Nhánh B: thấy MỌI BS. attending_doctor_id = appointment.doctor_id (TKYK không bị ghi là người khám). TKYK KHÔNG finalize (giữ cho BS).
- bc29641 — Địa chỉ dropdown sau sáp nhập: mig054, bảng province (34) + ward (3321), nguồn ThangLeQuoc/vietnamese-provinces-database tag v3.1.0 (cấu trúc tỉnh→phường bỏ huyện). Form intake 2 select phụ thuộc. BN cũ free-text giữ nguyên.
- 2d9daea — Sửa wording board Lễ tân ("không chỉnh sửa" → "xem lâm sàng, ĐƯỢC sửa hành chính") + tên BS 3 chỗ sót (home greeting, TasksRealtime, schedule/edit).
- fabda0a — CSKH: field van_de_di_kham (text) + linh_vuc (mig055, CHECK 5 mã = TÁI DÙNG service_code PK/SK/NT/HMVS/NK, sẵn map sang form khám). KHÔNG đụng "Lý do khám" của BS.
- 5add7f0 — Form số đo siêu âm: ultrasound_record.findings JSONB (mig018 đã có), 7 số đo CRL/NT/BPD/HC/AC/FL + EFW NHẬP TAY (// TODO auto-EFW chờ Hadlock BS Thắng). 4 nút Bắt đầu/Lưu/Bất thường/Hoàn tất. Gate isUltrasoundDoctorRole, chặn ghi khi FINALIZED.
- 0bc6d47 — FIX dropdown tỉnh trống: gốc = RLS bảng province/ward bật nhưng KHÔNG có policy SELECT → authenticated đọc 0 dòng. Sửa: đọc bằng service-role bypass RLS (data hành chính công khai, server-only an toàn).

---

## TRẠNG THÁI Ô VÀNG EXCEL (12 mục): 10 XONG
- ✅ 3.0/18.0 TKYK · 4.0 PT→Phẫu thuật + tên BS · 6.0 giới tính Khác · 10.0 địa chỉ dropdown · 11.0 ngày DD/MM/YYYY · 12.0 bỏ BS duyệt + check-in Lễ tân · 13.0 Lễ tân sửa BN · 15.0 ĐD sửa Lý do khám · 16.0 sinh hiệu HA/CN/CC + dấu *
- ⚠️ 1.0 Trưởng ca: LỆCH SPEC — đã làm hành chính-only (theo recap 17/6), Excel ghi "toàn bộ". CHỜ QUANG CHỐT.
- ❌ 5.0 CM/lịch làm việc: scope chưa rõ (Excel có 2 đề xuất). CHỜ PK.

## TRẠNG THÁI HTML 7 MỤC: 5 trọn + 1 vừa xong + 1 defer
- ✅ #1 CSKH nhắc gọi · #2 lễ tân progress · #4 ĐD siêu âm 2 hàng đợi · #5 form theo dịch vụ · #6 BS siêu âm số đo (vừa xong)
- ⚠️ #3 thu ngân: role tách XONG; THIẾU hóa đơn QR + billing thuốc (chờ STK VietQR + bảng giá PK)
- ⏸️ #7 lưu ảnh: Phase 3 defer (đã chốt)

---

## CHỜ PK/QUANG/BS 24/6 (KHÔNG code được — thiếu input người)
1. ⚠️ 4.1 LỖ HỔNG NGHI: api/lab-result PATCH KHÔNG check FINALIZED → có thể sửa lab sau khi visit chốt. PK quyết: kết quả XN về muộn nhập vào đâu — amendment (có vết) hay sửa thẳng? (Tuyền test tay xác nhận trước.)
2. 1.0 Trưởng ca: "toàn bộ" (Excel) hay "hành chính only" (recap 17/6)? → Quang.
3. 5.0 CM khác Trưởng ca chỗ nào + cơ chế lịch làm việc (2 đề xuất).
4. 3.4 slot gối giờ overbook: 1 khung tối đa mấy BN, giới hạn theo BS/phòng/dịch vụ? (mig012 đang CHẶN trùng — cần gỡ đúng cách.)
5. 3.5 cấu trúc tóm tắt điều trị đa-visit → BS Thắng.
6. auto-EFW: công thức Hadlock? → BS Thắng.
7. Form tiền hôn nhân + NPĐH: field lâm sàng → BS đưa.
8. linh_vuc CSKH chọn → có AUTO chọn form khám tương ứng không? (mã đã trùng service_code, wire 1-line nếu PK muốn.)
9. #3d hóa đơn: STK + ngân hàng để sinh VietQR + bảng giá thuốc.
10. 3 thuốc needs_review → DƯỢC: Fes 1/10 · Utrogestan (Đ)/(U) · nhóm Difavon/Diflucan/Fluconazole.

---

## NỢ KỸ THUẬT
- RLS policy: province/ward đang đọc bằng service-role (vá). Idiomatic = thêm RLS policy SELECT giống service_type. Không gấp (data công khai, không PII).
- 88 row work_roster.staff_name cũ vẫn tên tắt (chỉ ca mới dùng full_name) — chưa backfill, ngoài scope.
- 4.1 PATCH lab-result chưa guard FINALIZED — chờ PK quyết (xem trên).
- in phiếu siêu âm chưa hiện số đo (chưa wire print).
- is_abnormal trong JSONB — nếu cần query "ca bất thường" thì promote thành cột riêng.
- ~42 commit LOCAL chưa push.
- 043 vẫn lỗ (append-only clinical chỉ app-layer cho clinical_record/lab_result; prescription xóa-ghi-lại tự do). Apply 043 + mở logEvent phủ thao tác lâm sàng = việc xin tài trợ làm sau.

---

## TUYỀN LOGIN TEST TAY (subagent không verify UI được)
1. ⚠️ 4.1 (ƯU TIÊN): nhập lab SAU khi visit FINALIZED → DB/API có chặn không? Lọt = báo lại (lỗ hổng).
2. Dropdown tỉnh /patients/new: ra 34 tỉnh chưa? Chọn tỉnh → phường lọc đúng? (vừa fix 0bc6d47)
3. ĐD nhập "Lý do khám" → BS vào sau, data còn không?
4. Lễ tân bấm tên BN → nút "Sửa thông tin" sáng + lưu được? (wording mới)
5. Tên BS đầy đủ ở lời chào + các board?
6. Gõ "hoa" có ra "Hòa" (search BN + nhân sự)?
7. Datalist "Chỉ định CLS" gợi ý + nhóm theo chuyên khoa? Picker thuốc lưu liều/HDSD?

---

## VIỆC NGOÀI CODE
- Push ~42 commit local khi sẵn sàng.
- Gửi DƯỢC 3 câu thuốc needs_review.
- Mang 10 câu (mục CHỜ PK) đi họp PK 24/6.
- Sửa pre-commit hook (gốc python@3.14 đã gỡ → Poetry chết): cài lại Poetry bằng python3.12 + poetry env use python3.12. Hiện đang --no-verify.

---

## QUY ƯỚC CẦU NỐI CLAUDE CODE ↔ PHIÊN CHAT (quan trọng)
Phiên chat (advisor) KHÔNG tự thấy việc làm bên Claude Code. Để advisor nắm thay đổi:
- Bên Claude Code: mỗi việc xong → ghi vào worklog/CURRENT_PROGRESS.md (delta + commit hash).
- Phiên chat sau: PASTE worklog này (hoặc git log --oneline -20) cho advisor đọc.
- Memory chỉ nhớ bối cảnh trong cuộc trò chuyện, KHÔNG tự cập nhật việc làm chỗ khác — phải tự kể/paste.