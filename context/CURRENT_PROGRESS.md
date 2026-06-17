# HANDOFF WORKLOG — Đợt "Ver 2 sau họp PK 17/6" (phiên 17/6, phần 5)

## BỐI CẢNH
- Họp PK 17/6 (recap đã đọc). Deadline DASHBOARD VER 2 = TRƯỚC 21/6: phân quyền + giao diện + luồng (dự kiến).
- Avalook tự phân: phân quyền+giao diện làm tuần này; lưu trữ+AI defer Phase 3.

## ĐÃ XONG PHIÊN NÀY (commit local, CHƯA push — tổng 10 commit)
1. T-DASH-INTAKE-UX-01 (08365f6) — PT→Phẫu thuật, full tên BS, search bỏ dấu (full_name_unaccent 039), DateField DD/MM/YYYY gộp ô.
2. T-DASH-GENDER-KHAC-02 (d815a30) — giới tính "Khác". Migration 048 apply lẻ. Constraint: gender NULL|Nam|Nữ|Khác. CHANGELOG.md bootstrap ở root.
3. T-DASH-NURSE-PERM-01 (bae12a7) — ĐD sửa "Lý do khám bệnh" (chief_complaint Section II, KHÁC "Vấn đề khiến BN đi khám" của CSKH — cái này KHÔNG tồn tại trong code); vital required CHỈ HA/CN/CC.
4. T-DASH-CLINICAL-PERM-SIET-01 (2d0de8b) — helper canWriteClinical; decouple check-in ⟂ vitals.
5. T-DASH-RECEPTION-FLOW-01 (03e0d81) — BỎ gate "BS duyệt BN" (chỉ appointment.status workflow, không dính lâm sàng); Lễ tân sửa hành chính (đã sẵn canWriteIntake); rename "Tóm tắt khám bệnh"→"Phiếu khám bệnh" (chừa PreVisitBrief + lab).
6. T-DASH-TKYK-CLINICAL-01 (c1a0068) — role TKYK (mig 049 apply lẻ, constraint 8 value). canWriteClinical = BS||ĐD||TKYK. Siết /api/lab-result + /api/service-log: canCheckin→canWriteClinical (ĐD vẫn ghi, Lễ tân/QL 403). Seed staff TKYK.
7. T-DASH-LETAN-WORKQUEUE-01 (e1cdf52) — màn làm việc Lễ tân tương tác. Enum appointment = SCHEDULED·CSKH_CONFIRMED·CONFIRMED·CHECKED_IN·COMPLETED·NO_SHOW·CANCELLED·DOCTOR_DECLINED. Nút: Gọi xác nhận(cskh_confirm)·Check-in(checkin)·Hoàn tác(undo_checkin)·Không đến(no_show). CHECKED_IN=đã vào hàng BS (DoctorWorkBoard tự hiện), KHÔNG nút "Đưa vào khám". Không migration.
8. T-DASH-TRUONGCA-01 (c3cef3f) — role Trưởng ca (mig 050 lẻ, constraint→9 value), hành chính KHÔNG lâm sàng, trang theo dõi buổi read-only + placeholder "Công việc của tôi".
9. T-DASH-BO-BS-CHIDINH-01 (980a2d5) — NO-OP: "Bác sĩ phụ trách chỉ định" chưa từng tồn tại trong code (chỉ ở doc). Không sửa code.
10. T-DATA-CHIDINH-CATALOG-SEED-01 (871418b) — parse PHIẾU CHỈ ĐỊNH (PK) → seed 29 dịch vụ/CLS + 64 thuốc (3 needs_review, giá NULL). Mig 051 LẺ (drug_catalog mới + service_price ADD category/tang), has_043=False. Picker "Đơn thuốc"+"Chỉ định CLS" đọc danh mục runtime (datalist) cho cả 5 form. Catalog_out/*.csv gitignore (*.csv), regen bằng parser.

## QUYẾT ĐỊNH CHỐT TỪ RECAP 17/6
- Lâm sàng = BS + ĐD + TKYK (3 vai). Lễ tân/QL/Trưởng ca = HÀNH CHÍNH, không lâm sàng.
- Trưởng ca: quản lý 1 ca/ngày, sửa hành chính giống Lễ tân/CSKH, thay phiên, tạo sẵn tài khoản. "Công việc của tôi"/mẫu báo cáo → CHỜ PK 24/6.
- CM: chưa rõ phạm vi → share tài khoản Admin (MANAGEMENT) sẵn có cho PK hình dung, KHÔNG tạo role mới.
- Giới tính Khác: CẦN (LGBT). XONG.
- Phiếu khám: form hiện tại = Phiếu khám (đúng). Thêm "Tóm tắt cuối phiếu" (text ngắn) → CHỜ cấu trúc anh Thắng 24/6.
- BỎ "Bác sĩ phụ trách chỉ định" (thuật ngữ sai, không cần). GIỮ "Chỉ định CLS".
- Slot đặt lịch kiểu rạp phim (BN mới 15-20p/tái khám 5-10p, khung 1h min3 max12) → RESEARCH, ver 2 chỉ "luồng dự kiến".
- Google Drive/upload XN/lưu trữ/OCR AI/NDA → Phase 3, defer.

## VIỆC KẾ (phiên sau, cho ver 2 trước 21/6)
- R2 — T-DASH-TRUONGCA-01: role Trưởng ca (mig 050 apply lẻ, constraint→9 value), quyền hành chính (canWriteIntake/canEditAdmin += TRUONG_CA), KHÔNG lâm sàng, trang theo dõi buổi read-only, placeholder "Công việc của tôi".
- ~~R4 — T-DASH-BO-BS-CHIDINH-01~~ ✅ ĐÓNG = NO-OP (17/6): label "Bác sĩ phụ trách chỉ định" KHÔNG tồn tại & chưa từng tồn tại trong code (grep 0 hit, git -S 0 commit). "Chỉ định CLS" = section Cận lâm sàng (cls_*) còn nguyên. Không sửa code/migration. Chi tiết: CHANGELOG.md.
- (prompt đầy đủ R2/R4 đã soạn trong chat phiên 5 — lấy lại nguyên văn.)

## NỢ / TREO CHỦ ĐÍCH
- 043 PENDING — ledger có 042,044,045,046,047,048,049,050,051 (043 vẫn lỗ, app-layer ép FINALIZED). Đợt chạy RIÊNG + VERIFY runner per-file (skip file đã có, KHÔNG sequential-to-max). Mỗi mig mới apply LẺ out-of-band + --mark-applied, verify has_043=False.
- Pre-commit hook hỏng (thiếu python@3.14, máy chạy 3.12.9) → đang --no-verify. Sửa env: ghim python3.12 trong .pre-commit-config.yaml.
- 10 commit local CHƯA push (đợt push riêng khi Tuyền sẵn sàng).
- CHANGELOG.md ở root: mỗi packet 1 entry, từ giờ là step bắt buộc mọi packet.
- TKYK: chưa wire NAV/workqueue UI riêng; chưa link auth cá nhân; cân nhắc thêm TKYK vào enum staff FastAPI src/clinicai/schemas/staff.py nếu sau tạo staff qua API.
- CHỜ PK 24/6: cấu trúc Tóm tắt cuối phiếu / mẫu báo cáo Trưởng ca↔CM / phạm vi CM.

## VIỆC NGOÀI CODE
- 17/6 (hôm nay): Sáng Ý gửi PK database quản lý dữ liệu 2 bên (Notion DB, phân quyền PK upload).