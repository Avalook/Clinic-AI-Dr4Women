# ClinicAI — Handoff Worklog
> Cập nhật: 2026-05-25 (cuối session) · Dev: Tuyền (solo) · Executor: Claude Code
> File NGUỒN DUY NHẤT cho tiến độ (đã hợp nhất worklog/ + .ai/worklog/ ngày 25/5). CLAUDE.md §1 trỏ vào đây.

---
## TRẠNG THÁI HIỆN TẠI
- Branch: feat/t-transform-01, đã PUSH lên GitHub (github.com/nguyencongtuyenlp/Clinic-AI-Dr4Women), working tree clean.
- Code clone về Windows (D:\ClinicAI Dr4Women\Clinic-AI-Dr4Women) CHỈ để đọc/sửa, KHÔNG dựng môi trường. Mọi việc CHẠY (migration/test/load) vẫn ở Mac Mini qua Claude Code. Windows pull trước khi sửa, Mac pull trước khi chạy.
- Mac Mini Tailscale: tên máy mac-mini-ca-quang, IP đã đổi thành 100.116.210.82 (IP cũ 100.119.13.22 chết). Dùng tên máy thay IP cho bền.

## KHẢO SÁT THẬT SESSION NÀY (3 file, đã đồng bộ với Planner)
### A. IMPORT_FACTS_FOR_REPORT.md (data cũ)
- THỰC TẾ 14 file/7 dataset (KHÔNG phải 16). Code chỉ dùng 5/7.
- 2 dataset LỚN NHẤT chưa import: CSKH Action 31.179 + Dịch vụ 15.075 = 46.254 dòng (nhiều hơn cả phần đã xử lý 42.752). CHƯA khảo sát nội dung 2 file này.
- Patient: 5.728 (🟢2.771 đủ DOB+gender / 🟡2.957 skeleton). reject 415 (100% do SĐT hỏng tại nguồn, 0 do tên rỗng; 55 dòng rỗng hoàn toàn).
- MPI thật chỉ 3 nhãn: SINGLE 5.419 / AUTO_MERGE 99 / REVIEW_CONFLICT 210 (KHÔNG có AUTO_MATCH/CREATE_NEW như doc).
- review_queue 220 dòng = 100% SAME_PHONE_DIFFERENT_NAME (phần lớn đặt hộ — LÀNH). Code KHÔNG có rule gỡ hậu tố "(huỷ)".
- 🚩 TRIPWIRE BỊ VƯỢT: kế hoạch ghi "reject hàng trăm → DỪNG", thực tế 415 vẫn xuất+commit. CHƯA soi tay 415 dòng này.

### B. SYSTEM_STATE_ACTUAL.md (hệ thống)
- DB: 17/35 bảng (+mpi_merge_queue +patient_summary VIEW). D4 đủ 5/5. D7 Finance + D8 Inventory = 0 bảng.
- Data BN THẬT CHƯA vào DB: patient=30 (demo), transform 5.728 còn ở file. NHỊP 2 LOAD CHƯA chạy.
- Seed DỞ: service_type=1 (cần 15), staff=0 (file seed 29 tồn tại nhưng chưa apply — cần điều tra vì sao).
- Code: 4/5 sub-graph THẬT (scheduling, lab_triage, task_manager, pre_visit_brief). communication = stub. pre_visit_brief CHƯA nối orchestrator. 412 test/12 skip.
- ⚠️ Voice-to-EMR = 0% (không có speech-to-text, chỉ có 3 cột DB chờ). Worklog cũ ghi sai — phải bỏ khỏi mọi danh sách DONE.
- 3 nợ Phase-1: patient_contact_channel (THIẾU → chưa có zalo_user_id), booking_channel (TEXT trần không FK), patient_next_of_kin (chưa có, defer được).

### C. Khảo sát Dashboard
- src/dashboard: Next.js 16.2.6 + React 19 + Supabase auth. ~40-50%, KHÔNG phải mockup.
- Route có: /login (auth thật), /work-sessions, /patients, /tasks — đều nối THẲNG Supabase qua RLS, KHÔNG qua FastAPI.
- Login ✅ (Supabase, gate proxy.ts + layout). Phân quyền role ❌ CHƯA (không role/RBAC/guard).
- Backend API: patient CRUD ✅, appointment create/get/confirm/cancel ✅ nhưng THIẾU GET /appointments lọc theo bác sĩ/ngày. Backend KHÔNG có auth (mở hoàn toàn), không CORS.

## QUYẾT ĐỊNH KIẾN TRÚC SESSION NÀY
- Đổi hướng: KHÔNG demo nhẹ nữa, build lát cắt production thật.
- Zalo/Pancake: chỉ xây KHUNG + adapter + mock (~"90% phần chủ động"), 10% cuối cắm key thật + sửa theo tài liệu thật khi có account.
- Phase 1 = Dashboard luồng "CSKH ghi khách+lịch → bác sĩ xem lịch+BN mình khám".
- Kiến trúc data-path Phase 1: ĐỀ XUẤT "Lai" (tạo BN qua FastAPI chạy MPI chống trùng + đọc qua Supabase). Tuyền nói muốn "bài bản + chống trùng" — CẦN LÀM RÕ đầu session sau: Lai hay full Đường B (full B kéo theo auth backend → trượt tuần 1).
- Scope: làm ĐỦ (không cắt), Tuyền làm thêm buổi tối ở nhà.

## VIỆC TIẾP THEO (đầu session sau)
1. CHỐT kiến trúc data-path: Lai hay full B (đang treo).
2. Đóng 3 Task Packet build Phase 1 theo thứ tự:
   - PACKET 1: nền phân quyền (role CSKH/DOCTOR vào staff + map auth user↔staff_id + guard role ở dashboard proxy.ts Next16 + auth tối thiểu cho backend vì API đang mở).
   - PACKET 2: luồng CSKH ghi (form tạo BN qua POST /patients chạy MPI + tạo lịch qua POST /appointments + xử ca MPI nghi trùng).
   - PACKET 3: luồng bác sĩ (thêm endpoint GET /appointments theo bác sĩ+ngày + trang "Lịch của tôi" + acc demo).
   - Thứ tự bắt buộc 1→2→3.
   - LƯU Ý: Next.js 16 — convention khác bản cũ (middleware = proxy.ts), dặn Claude Code không dùng pattern Next 14/15.

## NỢ / VIỆC TỒN ĐỌNG (chưa làm, đừng quên)
- Vá nền trước LOAD: patient_contact_channel + booking_channel + bảng prescription (rx 15.319 PARKED) + seed service_type 15 + apply staff 29. (Đã soạn Task Packet gộp A+B+C nhưng CHƯA chạy — Tuyền chuyển hướng sang dashboard trước.)
- Soi tay 415 dòng reject + 3 BN full_name rỗng (vi phạm NOT NULL khi LOAD).
- Khảo sát nội dung 2 file CSKH 31k + Dịch vụ 15k → quyết chúng map bảng nào (CSKH có zalo_user_id? Dịch vụ có giá tiền → invoice?). Treo con số "data lấp được 6-16/35 bảng".
- Sửa worklog cũ: bỏ Voice-to-EMR khỏi danh sách DONE.

## ĐÃ GIAO PM
- File "ClinicAI — Hiện trạng & Kế hoạch làm việc của DEV": kế hoạch 4 tuần có cờ 🟢🟡🔴.
  - Tuần 1 dashboard (cam kết) · Tuần 2 speech-to-text+VPS (làm dần, ~2 tuần) · Tuần 3 Zalo/Pancake (phụ thuộc key, 1 tuần TỪ LÚC NHẬN KEY) · Tuần 4 tự gửi tin (họp lại).
  - Nhấn: "dùng thử song song ≠ production"; nút thắt = sếp lấy key Zalo/Pancake sớm.
- 3 phương án nhập liệu chờ HỌP sếp/PM chốt: (1) nhập song song (2) nhập sau ca (3) cấp quyền Notion để dev cắm API (PA3 = dự án con, không nằm tuần 1).

## NÚT THẮT CẦN TEAM (không phải việc dev)
- Sếp/chị Hoa: API key Zalo OA + Pancake → chặn tuần 3-4.
- Sếp/PM: chốt luồng nhập liệu (3 phương án), chốt cách tính công/lương (theo buổi, 8 buổi/tuần).

## QUY TRÌNH (giữ nguyên)
- Mỗi session/lần làm: Claude Code xuất file trạng thái thật → Tuyền đưa Planner → đồng bộ. KHÔNG tin doc cũ (đã lệch nhiều lần).
- Task Packet: Step 0 verify → 1 khảo sát read-only → 2-3 code+test → 4 lint/mypy/pytest → 5 commit local → 6 báo cáo 5 dòng. Packet nhỏ, verify từng phần.

---
## CARRY-OVER KỸ THUẬT (giữ từ phiên transform 24/5 — T-TRANSFORM-01)
> Hợp nhất từ bản context/ cũ. Các chi tiết này KHÔNG có trong handoff trên nhưng còn cần cho NHỊP 2 LOAD.

### 3 LỆCH SCHEMA cho NHỊP 2 LOAD (QUAN TRỌNG)
1. prescription KHÔNG có bảng đích → file PARKED (no_target_table), cần TẠO BẢNG trước khi load rx (15.319 dòng).
2. clinical_record link qua visit_id (NOT NULL UNIQUE), KHÔNG có clinic_patient_id trực tiếp → LOAD phải TẠO visit trước.
3. lab_result dùng cột triage_group='PENDING' (KHÔNG phải result_classification).

### NOT NULL thiếu nguồn (LOAD xử lý)
- patient.location_id (default 1-clinic), patient.patient_code (DB sinh), appointment.location_id/service_type_id (raw TEXT, fk_unresolved=true), appointment.slot_end (suy ra). gender/address giữ ở *_staging.
- Map raw TEXT (BS Thành / Phụ khoa / Kim Ngưu) → FK master = task con trong NHỊP 2.
- TIẾP: Tuyền soi TRANSFORM_REPORT + patient_staged + review_queue → OK thì đóng Task Packet NHỊP 2 (LOAD staging). 8 file output ở scripts/data_migration/output/ (gitignore).

### Sự thật kỹ thuật DATA (cho transform/audit)
- 7 nhóm CSV, LUÔN dùng bản hậu tố `_all` (đầy đủ hơn bản thường — số planning cũ 594/2974 SAI vì từ bản non-_all).
- Encoding utf-8-sig. CÓ newline trong ô → ĐỌC bằng csv.DictReader, KHÔNG pd.read_csv C-engine (vỡ).
- File .md = record con xuất riêng, nội dung ĐÃ nằm trong CSV → BỎ QUA toàn bộ .md.

### VỊ TRÍ DATA (chống lộ data y tế)
- Data BN ĐỂ NGOÀI repo, ngang hàng (vd ../_clinic_data_raw/notion_export/), git KHÔNG thấy. transform.py nhận đường dẫn qua --input-dir.
- Output staged files ra scripts/data_migration/output/ (gitignore). KHÔNG commit data BN.

### NỢ MÔI TRƯỜNG (carry-over từ C1 — giữ cho C3)
- Mac Mini build qua SSH: đã bỏ credsStore + scout/ai hooks trong ~/.docker/config.json (backup config.json.bak). Rename 2 helper .disabled: docker-credential-desktop + docker-credential-osxkeychain. Pull ẩn danh OK.
- C3 cần docker login đẩy ghcr.io → PHẢI khôi phục 2 helper trước (mv .disabled về tên gốc).



## CẬP NHẬT 26/05 — KHẢO SÁT NOTION GỐC THẬT (lật giả định lớn)
- ĐÃ XEM Notion gốc thật của PK (6 ảnh). PHÁT HIỆN LẬT NGƯỢC:
  Notion gốc LÀ DATABASE CÓ CỘT (Table/Map/Chart view), KHÔNG lỏng
  như file export tưởng. Export làm méo cấu trúc → đừng dùng export
  cũ để ước lượng độ khó nữa. Kéo qua API GIỮ NGUYÊN cột → dễ hơn parse export.
- Kiến trúc Notion PK: 2 file lưu trữ (BN lâm sàng + khách hành chính)
  + 8 db vận hành (CSKH-Action, LỊCH HẸN, Kê thuốc, Chấm công, Dịch vụ,
  Xét nghiệm, Phiếu khám, Nhật ký) + lib1-8 + 4 trang BRIDGE (đã có
  relation/automation giữa các db). "File khách hàng" đếm 601 dòng.
- CỘT SẠCH kéo ngay: Loại dịch vụ (multi-select), Created time, Link drive,
  Dự kiến sinh, Tuổi thai, Giới tính, Địa chỉ.
- CỘT BẨN phải xử: Họ tên = tên+SĐT NHỒI CHUNG 1 cột (tách regex, đã có
  từ transform). Còn dòng rỗng tên + mã LAMSANG-xxxx skeleton sống trong Notion.
- DATA VẪN SỐNG: Created time mới nhất 17/5/2026 (PK vẫn nhập đều, cấu
  trúc y nguyên). Database gốc có icon ⚠️ + bản Notion FREE.
- QUYẾT ĐỊNH KIẾN TRÚC (đã chốt với Planner):
  * Source of truth giai đoạn dùng thử = NOTION (đường A). Dashboard CHỈ ĐỌC.
  * Cơ chế: poll Notion API định kỳ → chuẩn hóa → MPI dedup → đổ Supabase.
  * BẮT BUỘC READ-ONLY tuyệt đối (DB gốc PK có ⚠️, không ghi ngược).
  * Đóng khung A là BƯỚC 1 tiến tới nhập-thẳng (đường C), KHÔNG để A vĩnh viễn.
  * PACKET 2 cũ (form CSKH ghi) → TẠM GÁC, thay bằng "cầu Notion".
  * PACKET 1 (phân quyền) + PACKET 3 (lịch bác sĩ) KHÔNG đổi, chạy được ngay.
- ƯỚC LƯỢNG cầu Notion 1 chiều: vài buổi → ~1 tuần (VỚI token). KHÔNG
  phải dự án vài tuần như lo ban đầu.
- NÚT THẮT MỚI (đẩy sếp): xin Notion integration token + share READ 2 db
  (File bệnh nhân + LỊCH HẸN). Giống nút thắt key Zalo.
- CÒN SOI NỐT (Tuyền đang làm): (1) Last-edited-time (gần như chắc CÓ qua
  API) (2) LỊCH HẸN nối BN qua Relation hay rời.
- CAM KẾT TUẦN 1 ĐỔI: từ "CSKH nhập trên dashboard" → "dashboard đọc
  realtime Notion + bác sĩ xem lịch/BN mình". PHẢI BÁO LẠI PM.
