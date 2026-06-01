# ClinicAI — Handoff Worklog
> Cập nhật: 2026-06-01 (deploy Vercel + fix RLS dropdown + đặt lịch BN có sẵn) · Dev: Tuyền (solo) · Executor: Claude Code
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



## CẬP NHẬT 26/05 (phiên 2) — ĐỊNH VỊ LẠI KẾ HOẠCH + KHẢO SÁT ĐỘ SÂU CODE

### Lệch kế hoạch đã sửa
- BỎ "kế hoạch 4 tuần / tuần 1 dashboard" — đó là bản phiên trước tự dựng, KHÔNG phải bản PM-Tuyền chốt. Bản PM thật (Lộ trình 12/5): chia A/B/C/D + 3 Phase (Onboard/Buổi khám/Sau khám), làm A→B→C mỗi phase. Dashboard (C) KHÓA sau A+B. Hiện đang ở A (A.2 chuẩn hóa, 26/5–5/6), hướng mốc CSDL ver 1 = 3/6.
- Đề xuất đọc-Notion định vị lại = nằm trong A.2 (không phải đổi hướng dashboard). Đã viết báo cáo A.2 gửi PM.

### Quyết định kiến trúc phiên này
- Data-path = đường LAI (đọc qua Supabase, ghi/đồng bộ qua FastAPI). Vì chọn Notion-là-nguồn nên Lai gần như mặc định.
- Dashboard tách 2 TẦNG: tầng ĐỌC làm sớm (hiển thị data Notion kéo về, demo + PK kiểm chứng) / tầng GHI làm muộn (cần nền dữ liệu chốt). Đã đưa vào báo cáo dạng GỢI MỞ để PM cho ý kiến, CHƯA chốt.

### KHẢO SÁT ĐỘ SÂU CODE (Claude Code đo, read-only) — SỰ THẬT QUAN TRỌNG
- CHỈ CÓ 4 SUB-GRAPH THẬT: scheduling, lab_triage, pre_visit_brief, task_manager.
  * communication = chỉ stub trong orchestrator, KHÔNG có thư mục graph.
  * voice_to_emr = KHÔNG TỒN TẠI ở đâu cả (worklog cũ ghi sai, bỏ hẳn khỏi mọi danh sách).
- [SỬA SAI 26/5 — câu cũ "4 graph chưa nối / router vẫn trả stub" là SAI, đã khảo sát + chạy test lại]: GHÉP NỐI ORCHESTRATOR đã làm sẵn từ T-P9.2-04, KHÔNG phải chưa làm. Phân loại 5 route trong orchestrator/graph.py:
  * scheduling / lab / task = đã có WRAPPER THẬT, bật theo pool (scheduling_pool+location_id / lab_triage_pool / task_manager_pool); không có pool → fallback stub. (graph.py:197-218, bind 234/235/237)
  * communication / previsit = còn STUB THUẦN trong orchestrator (graph.py:225/227). pre_visit_brief có graph thật nhưng chỉ expose qua API, CHƯA nối vào router.
  * Luồng xuyên suốt lab_triage ĐÃ verify: test_e2e_lab_triage.py 4/4 PASS (no-id ack / GROUP_A advise / GROUP_C safety-gate / no-pool fallback stub). Còn lại CHƯA verify e2e: communication, previsit.
- Độ sâu LỆCH (không phải vertical-slice mỏng đều): scheduling 421 dòng / lab_triage 407 (sâu) vs pre_visit 141 / task_manager 214 (mỏng). lab_triage (Phase 2-3) sâu hơn scheduling (Phase 1) → đã đào sâu phần rủi ro cao (xét nghiệm/safety) trước, là lựa chọn ưu tiên, KHÔNG thuần "đặc thù code".
- Test gần 100% mock; chỉ 2 test orchestrator chạm LLM thật (skipif theo key); 0 test chạm DB thật.

### VIỆC ĐANG LÀM (phiên sau tiếp)
- PACKET B (lab_triage nối orchestrator + e2e): ĐÃ XONG TỪ TRƯỚC (T-P9.2-04), phiên 26/5 chỉ xác minh lại — 4/4 e2e PASS. Không cần code thêm.
- CÒN LẠI để nối orchestrator: communication + previsit (2 stub thuần). scheduling/task đã có wrapper, chỉ cần truyền pool khi chạy thật.
- [QUYẾT ĐỊNH 26/5 — HOÃN PACKET C, đóng phần ghép-nối agent giai đoạn A]:
  * previsit = STUB CÓ CHỦ ĐÍCH, defer tới P13 (cron/event trigger) đúng ghi chú trong orchestrator/stubs.py. Lý do: brief là luồng pull/event-driven (sinh brief cho 1 BN cụ thể), không phải intent hội thoại; graph THẬT đã chạy qua API POST /api/v1/brief/{id} rồi → không nối vào router chat lúc này để tránh nhánh chat ack-thiếu-id vô nghĩa.
  * communication = STUB CHỜ ZALO (chặn bởi nút thắt key Zalo, chưa có tích hợp kênh).
  * Phần GHÉP NỐI AGENT của giai đoạn A coi như ĐÓNG: lab_triage nối + verify xanh (4/4 e2e); scheduling/task có wrapper sẵn bật theo pool; previsit/communication hoãn có chủ đích. Không code ghép-nối thêm ở giai đoạn A.

### NỢ / NÚT THẮT
- Xin Notion token (read-only, 2 db: File bệnh nhân + LỊCH HẸN) — đẩy PM/sếp. Chặn A.2 làm trên data thật.
- Soi nốt LỊCH HẸN trên Notion: có Relation nối BN không + cột ngày giờ hẹn riêng không.
- Báo cáo gửi PM phiên này: (1) Báo cáo A.2 + xin token (2) Bản toàn cảnh "đã làm gì + vì sao nhanh cho sau" — bản toàn cảnh CẦN SỬA: bỏ voice-to-EMR (không tồn tại), chỉnh "phần khó xong rồi" → đúng thực tế CHƯA nối orchestrator.

## CẬP NHẬT 26/05 (phiên 3) — TOÀN CẢNH PIPELINE DATA + CHỐNG DRIFT

### MPI + CLEAN + review_queue ĐÃ XONG — KHÔNG LÀM LẠI
- Toàn bộ EXTRACT → CLEAN(normalize phone+DOB) → MPI(merge rule) → review_queue → rejects ĐÃ hoàn thành trong `scripts/data_migration/transform.py` (T-TRANSFORM-01, commit ef538d5). KHÔNG xây script clean_and_mpi.py mới (sẽ trùng + phân kỳ rule). Đã hủy packet đó.
- Test transform: `pytest -k transform` = 20/20 PASS (norm_phone / norm_dob dd-mm-yyyy+GMT+7→ISO / extract_phone tách tên+SĐT).
- MPI rule (transform.py `_PatientIndex`): same phone+name → AUTO_MERGE; same phone+diff name → REVIEW_CONFLICT; còn lại SINGLE. Khóa = `//sdt (neat)` + `//họ tên (neat)`, KHÔNG dùng CCCD (0/16 file có).

### SỐ LIỆU THẬT (TRANSFORM_REPORT.md — authoritative)
- 5728 BN = 2771 COMPLETE (có DOB+gender) + 2957 SKELETON (chỉ name+phone).
- AUTO_MERGE 99 · REVIEW_CONFLICT 210 · rejected no-phone 91 · review_queue 220 dòng.
- Child staged: appointment 9996 · lab 5010 · prescription 15319 · clinical 6013.
- Output files: scripts/data_migration/output/{patient,appointment,lab_result,prescription,clinical_record}_staged.csv + review_queue.csv + rejects.csv (gitignored, chứa PII — KHÔNG commit).

### BƯỚC DUY NHẤT CÒN THIẾU CỦA PIPELINE DATA
- **LOAD/COMMIT staged CSV → Supabase** (chưa có script). Cần: insert dedup-aware theo `merge_action`, gán `patient_code` qua advisory lock, resolve FK `location_id`/`service_type`, tạo `visit` parent cho clinical_record (clinical link qua visit_id). transform.py cố ý không mở DB ("no SQL emitted").

### CẢNH BÁO CHỐNG DRIFT (quan trọng)
- 3 LẦN DRIFT trong phiên 26/5: (1) worklog ghi "router vẫn trả stub" — thực ra lab_triage đã nối; (2) packet "nối lab_triage" — đã xong từ T-P9.2-04; (3) packet "clean_and_mpi.py" — MPI đã xong trong transform.py. LUÔN đọc code/worklog xác minh TRƯỚC khi ra packet, KHÔNG tin memory/giả định.

## === ĐÓNG PHIÊN 26/5 (phiên dài) ===

### TRẠNG THÁI GIT
- Branch feat/t-transform-01, HEAD 5b82349, đồng bộ origin (đã push).
- Tree clean.

### 3 LẦN BẮT DRIFT TRONG PHIÊN (bài học)
- lab_triage: tưởng chưa nối orchestrator → THẬT đã nối + 4 e2e test xanh (T-P9.2-04).
- previsit: suýt nối lại → THẬT đã có ở API, nối router defer P13 (cron). Giữ stub.
- MPI/CLEAN: tưởng phải xây clean_and_mpi.py → THẬT đã xong trong transform.py.
- RULE: LUÔN đọc code/worklog xác minh TRƯỚC khi ra packet. KHÔNG tin trí nhớ doc.

### AGENT — GIAI ĐOẠN A: ĐÓNG
- 5 route orchestrator: scheduling+lab+task = WRAPPER THẬT (bật theo pool). communication = stub chờ Zalo. previsit = stub defer P13/cron.
- 2 stub là CÓ CHỦ ĐÍCH, không phải nợ kỹ thuật.
- voice_to_emr KHÔNG TỒN TẠI — Phase 2, không động.

### DATA — LOAD DRY-RUN: XONG
- transform.py (T-TRANSFORM-01): EXTRACT+CLEAN+normalize(phone E.164,DOB ISO)+MPI+review_queue+staged CSV. Test 20/20 PASS.
- load_to_staging.py (5b82349): load staged→schema tạm (temp_schema_db, rollback+DROP CASCADE), FK-fail=0.
- Count: patient 5518, appt 9170, visit 5583, clinical 5583, lab 4724, prescription PARKED.
- patient_code qua pg_advisory_xact_lock; slot_end=slot_start+30'; service_type gom 'KHAC'.

### 3 NÚT CHẶN TRƯỚC PROMOTE THẬT (đều cần input NGOÀI code)
1. ⚠️ DATABASE_URL trỏ THẲNG prod pooler — PHẢI tách DB test riêng trước khi promote.
2. service_type thật của Dr4women (hiện gom hết 'KHAC') — chờ danh sách dịch vụ từ phòng khám.
3. Tải đợt 2: 210 REVIEW_CONFLICT (cần người duyệt) + 142 appointment thiếu slot_start.

### VIỆC TREO KHÁC
- Notion token read-only — chờ, để soi LỊCH HẸN (Relation nối BN? cột ngày giờ?).
- Báo cáo A.2 + tin PM/sếp — chưa gửi.

### KẾ HOẠCH
- Đang A.2 (26/5–5/6), mốc CSDL ver1 = 3/6. Lộ trình A→B→C.
- Việc tiếp logic: giải 3 nút chặn promote (cần input ngoài) HOẶC Notion token (cần token).

## === HANDOFF — SESSION 26/5 PHIÊN CUỐI ===
Date: 2026-05-26 · Branch: feat/t-transform-01 · HEAD: e830828 (PUSHED — origin synced)

### COMMITS SESSION NÀY (đã push)
- bd1752f: demo full-route scheduling + Anthropic thật (Haiku classify 0.98 + Sonnet respond)
- 79aab1e: wire previsit_brief router. LƯU Ý: wrapper đã bind (4/5 route có wrapper) NHƯNG previsit CHƯA reachable — classifier chưa emit "previsit" (xem GAP e830828). Reachable thật = 3/5 (scheduling/lab/task).
- 3d95585: DB isolation via DATABASE_URL_TEST (408/48/0; safety_gate_017 5/5 PASS verified vs prod-temp-schema)
- e830828: docs previsit.trigger GAP report (docs-only, KHÔNG code)

### PHÁT HIỆN KIẾN TRÚC QUAN TRỌNG
- MỌI input vào orchestrator qua classify_intent — KHÔNG có bypass nào.
- Lab triage tới bằng route=="lab", KHÔNG bypass classify (giả định cũ SAI).
- Previsit cron cần: (a) event_type + work_session_id vào OrchestratorState (b) "previsit" vào RouteType + VALID_ROUTES (c) START-conditional mới. CHI TIẾT: scripts/scheduler/PREVISIT_TRIGGER_GAP.md.
- Đợt docstring EN→VI tự động (48 file) đã REVERT (206 lỗi E501, làm mất doc safety) — không vào history.

### TRẠNG THÁI: A~80% / B~65% / C 0% / D~40%
TEST: 408 pass / 48 skip / 0 fail. Safety gate 017: 5/5 PASS verified.

### VIỆC TIẾP
1. Packet State+RouteType (event_type/previsit vào State) — gỡ boundary sửa state.py.
2. Packet C3 deploy Caddy+TLS Mac Mini 100.119.13.22.
3. Provision Supabase test DB riêng (chạy 48 DB test, gồm 27 integration DELETE-public).
4. Wire RabbitMQ thật.

### 3 NÚT CHẶN PROMOTE: DB test riêng + service_type thật + 210 REVIEW_CONFLICT duyệt

## === HANDOFF — SESSION 27/5 (dashboard read-tier + tool registry) ===
Date: 2026-05-27 · Branch: feat/t-transform-01 · HEAD: d1ad3ca (PUSHED — origin synced) · Tree clean

### COMMITS SESSION NÀY (đã push, theo thứ tự)
- e1bca28: feat dashboard /appointments — 2 tab (Chờ xác nhận / Đã xác nhận) qua ?tab=pending|confirmed. Server Component, appointment JOIN patient + staff(doctor LEFT) + service_type. Filter hôm nay, slot_start ASC, limit 50. Nav thêm "Lịch hẹn".
- c6d1ab8: refactor relocate test orchestrator src/tests/orchestrator/* → src/tests/services/orchestrator/ (12 file rename 100%, có sẵn uncommitted đầu phiên, không phải việc của packet).
- f540848: feat dashboard /patients/[id] — chi tiết BN + lịch sử lịch hẹn (appointment JOIN staff + service_type, slot_start DESC, limit 20). Tên BN ở list → link detail.
- d57537a: feat redesign UI Linear/Vercel — sidebar tối #0a0a0a 220px + active indigo border; cards/tables trắng hairline radius8 shadow; pill tabs; StatusBadge dùng chung 6 token màu status; Geist qua font-sans wrapper.
- 289dfbe: feat lucide icons + stats cards + polish — Nav emoji→lucide-react; stats row (3 count-only card Promise.all) ở patients + appointments; PatientsList sticky header + row cursor + icon empty state; globals.css sửa Arial→Geist.
- d1ad3ca: feat tools/registry.py — central tool registry self-register (xem mục dưới).

### DASHBOARD (tầng ĐỌC — khớp định hướng "đọc sớm/ghi muộn")
- Route MỚI: /appointments (2 tab), /patients/[id] (detail + lịch sử). Đều Server Component, đọc THẲNG Supabase qua getSupabaseServer() (RLS), KHÔNG qua FastAPI, KHÔNG join national_id_number (D-identity).
- UI redesign theo DESIGN TOKENS chốt ở commit d57537a (sidebar #0a0a0a / canvas #fafafa / ink #171717 / hairline #e4e4e7 / accent indigo #6366f1 + 6 status badge color). lucide-react = dep MỚI DUY NHẤT được thêm.
- Next.js 16: Server Component pattern giữ nguyên; active-nav cần usePathname → tách Nav.tsx (client). StatusBadge.tsx + StatCard.tsx = component dùng chung (không phải route).
- npm run build PASS, TypeScript clean ở mọi commit.

### TOOL REGISTRY (d1ad3ca) — nền cho agent gọi tool
- src/clinicai/tools/registry.py: ToolMeta + ToolRegistry (register/get/list_toolset/list_all/to_anthropic_tools) + singleton REGISTRY. 16 tool / 8 toolset tự register khi import.
- QUYẾT ĐỊNH (chốt với Planner giữa phiên):
  * Register CẢ 5 scheduling tool (create/cancel/confirm/find_oncall_staff/find_work_sessions), KHÔNG phải 4 như packet — code có đủ 5 tool sạch. Test assert list_toolset("scheduling")==5.
  * LOẠI render_brief_markdown (sync, trả str — không phải LLM-callable tool). → brief=1 tool. Tổng=16.
  * input_schema nới thành type[BaseModel] | None (task.check_task_sla nhận raw UUID, không có Input model); tool trả list[Model] → output_schema = element model.
- ⚠️ CIRCULAR IMPORT (đã fix): services.patient_context_service import tools._common.context (TraceContext); brief/generate_brief import ngược patient_context_service. Khi tools/__init__ import eager toàn bộ toolset → re-enter service nửa chừng → vỡ. FIX trong scope: LAZY LOAD — REGISTRY gọi load_all() lần đọc đầu, KHÔNG import toolset lúc package-import. KHÔNG sửa services / tool functions (đúng boundary).
- Test src/tests/tools/test_registry.py 5/5 PASS. Full non-db suite 413 PASS (không regression). ruff + mypy clean.

### ORCHESTRATOR — EVENT-DRIVEN ROUTING (2 packet sau, đã push)
- 20c1193 (Packet State+RouteType): state.py — RouteType thêm "task"+"previsit" (graph.py đã dùng trong _VALID_ROUTES nhưng RouteType chưa khai); OrchestratorState thêm event_type + work_session_id (NotRequired) cho event-driven. Non-db suite 413 PASS.
- c4ca058 (Packet START-conditional event-driven): nodes.py + llm_nodes.py — cả rule-based VÀ LLM classify check state["event_type"] TRƯỚC, route thẳng qua map_event_to_route() (lab_result_received→lab, appointment_created→scheduling, previsit_trigger→previsit, task_overdue→task, default→general), SKIP LLM. VALID_ROUTES + prompt mở 5→7 route. Test mới test_event_driven_route.py 6/6 PASS, non-db suite 419 PASS.
- KIẾN TRÚC: KHÔNG cần START-conditional edge riêng — node classify tự short-circuit theo event_type → đạt mục tiêu "skip LLM khi event-driven" mà KHÔNG sửa graph.py (đúng boundary). Muốn bỏ hẳn node classify bằng conditional edge từ START = packet riêng cho graph.py.
- previsit/task giờ ĐÃ reachable qua event_type (RabbitMQ dispatch). Trước đây previsit chỉ tới qua API; classifier chat vẫn emit được "previsit"/"task" theo keyword nhưng luồng chính là event-driven.
- LƯU Ý mypy: nodes.py/llm_nodes.py còn lỗi `dict` bare type-arg PRE-EXISTING (mypy strict, KHÔNG nằm trong pre-commit) — không sửa vì ngoài scope, không phải lỗi mới.

### LƯU Ý CHO PHIÊN SAU
- Registry mới này là điểm vào để orchestrator/agent liệt kê tool gọi Claude API (to_anthropic_tools). communication.send_zalo vẫn [STUB].
- Nếu sau này muốn import eager toolset ở tools/__init__: phải gỡ vòng services↔tools._common (vd dời TraceContext ra clinicai.core) — hiện lazy-load né được, chưa cần.
- Dashboard ghi (form CSKH) vẫn GÁC theo quyết định 26/5 (Notion = nguồn, dashboard chỉ đọc).
- HEAD cuối phiên 27/5 = c4ca058 (cập nhật sau khi block này viết: thêm 20c1193 + c4ca058).


## === PHIÊN 29/5 — P1+P2+P3 done (Notion clone → Supabase) ===

### Bối cảnh & quyết định kiến trúc
- Bỏ chờ API prod (chặn ngoài tầm dev). Dùng clone bản Notion bạn duplicate sang workspace Avalook (LINK_NOTION_PAGE_ID=36eccb0e…) làm nguồn duy nhất cho demo Phase 1.
- Bỏ CSV staged cũ (`scripts/data_migration/output/*.csv`) — không biết PK xuất đủ chưa, dùng clone tiện hơn. transform.py giữ nguyên (cùng MPI rule), CHỈ đổi nguồn từ CSV sang Notion API qua adapter mỏng.
- Mỗi packet commit local theo Task Packet, KHÔNG push. 4 commit phiên này.

### P1 (ADMIN-RESET-01) — commit 0471000
- Seed `service_type` 14 (Notion options: Sản 1/2/3, NPĐH, Hồ sơ sinh, Tiền hôn nhân, Hiếm muộn, Nội tiết – Tình dục, Phụ khoa, Nam khoa, Tư vấn chuyên sâu, ***#Thủ thuật, FREE, Khám tiền sản). code = ASCII-upper-underscore của name; Notion option_id giữ comment SQL để sync sau khớp tự động.
- Seed `staff` 40 (Notion lib 3 = 50 row → loại 4 master + 6 job-role rows → còn 40 NV thật). Mapping department: BS→DOCTOR(11), BS SA→ULTRASOUND_DOCTOR(6), ĐD/TL→NURSE_ULTRASOUND(16), ĐD chỉ có 'Lễ tân' dept→RECEPTION(2), không prefix→CSKH default(5).
- Xoá 30 demo BN qua `scripts/seed/demo_seed.py --wipe --yes` (an toàn, chỉ DELETE theo phone trong seed_sample.json).
- Final counts: patient=0, staff=40, service_type=14, clinic_location=2.
- Sửa lệch spec ban đầu: file seed staff cứng `004_staff.sql` chỉ 29 dòng — KHÔNG apply (drift PK), dùng `005_staff_from_notion.sql` generated.
- 5 dòng CSKH default (Diệu Hoa, Huyền Diệu, Kim Tiến, Kiều Thủy, Trang A) là heuristic — Tuyền nên verify, fix nhanh bằng UPDATE.

### P2 (SEC-API-01) — commit 16ba13b
- 4 RLS migrations (021-024) trên visit/clinical_record/lab_result/appointment. Pattern mirror 020: ENABLE RLS + CREATE POLICY FOR SELECT TO authenticated USING (true). KHÔNG mở anon, KHÔNG mở write.
- Verify thật: insert sentinel patient qua DB pool (postgres role) → anon REST GET 5 PII tables = [] → backend pool còn thấy → xoá sentinel.
- API-key middleware `src/clinicai/api/auth.py` + register `main.py`. Exempt /health, /health/db, /docs, /openapi.json, /redoc. Constant-time compare. Missing key → 401, wrong → 403, env unset → log warning + pass-through (dev fallback).
- 35 test mới (5 auth + 28 RLS parametric + 2 health regression). Tất cả PASS.

### P3 (NOTION-SYNC-01 v1) — commit 30c7028
- Adapter `scripts/data_import/notion_to_sources.py`: 5 source DBs (admin/clinical/appointment/lab/prescription) → `dict[str, list[dict[str, str]]]` format trasform.py nhận. prop_to_str handle mọi ptype clone dùng (title/rich_text/select/multi_select/status/date/url/email/phone_number/checkbox/formula/rollup/relation/unique_id/place/verification/array/created_time/last_edited_time). Quan trọng: ISO date → `dd/mm/yyyy[ HH:MM (GMT+7)]` để parse_datetime_vn nhận. 5-step exp backoff cho Notion 5xx + "datastore timeouts".
- Orchestrator `sync_to_supabase.py`: TRUNCATE 5 PII tables → INSERT theo dependency. Master-data resolve theo name lowercased. patient_code qua advisory_xact_lock. In-batch doctor-overlap deduper (NULL doctor_id trên trùng giờ → tránh fire exclusion constraint `appointment_no_doctor_overlap` — clone có 15-min interleaved double-book). `--dry-run` rollback qua sentinel exception. `--limit N` cap smoke test. `_connect_with_retry` lo pgbouncer drop trong Notion pull dài.
- 41 test mới (21 adapter + 20 sync helpers). Tất cả PASS.
- E2E verify --limit 200 (1000 input rows): patient=278, appointment=188, visit=123, clinical=123, lab=0, review_queue=7, rejects=483.
- lab=0 + prescription PARKED là EXPECTED — clone đã đứt cross-DB relation. transform.resolve_patient extract phone từ relation/link field → empty → reject. Fix data-side khi có prod token; không phải bug code.

### TRẠNG THÁI HIỆN TẠI (cuối phiên)
- Branch: feat/t-transform-01, HEAD = 30c7028, 4 commit phiên này (3ac3e7c notion-client, 0471000 P1 seed, 16ba13b P2 RLS+auth, 30c7028 P3 sync). Chưa push.
- Wet sync full chạy nền lúc commit P3 (bdjar4tpj). Chưa biết kết quả cuối — Notion API hôm nay flaky với "datastore timeouts".

### P4 (DASH-RBAC-01) — commit ea819bf + 900172a + 379cf97
- Migration `025_staff_auth_link.sql`: `staff.auth_user_id UUID NULL` + FK `auth.users(id) ON DELETE SET NULL` + partial UNIQUE index trên non-null. Applied live + verify schema.
- CLI `scripts/seed/link_staff_to_auth.py`: `--map "Tên=uuid"` (repeatable), `--unlink`, `--dry-run`. Idempotent. Cho operator chạy sau khi tạo Supabase Auth user.
- Helper `src/dashboard/lib/current-staff.ts`: `getCurrentStaff()` React-cached lookup staff theo auth.uid(). `isDoctorRole()` = DOCTOR | ULTRASOUND_DOCTOR.
- Appointments page (`appointments/page.tsx` + `AppointmentsList.tsx`): thêm `?scope=me` filter `doctor_id = staff.id`. Toggle "Tất cả" / "Của tôi" chỉ hiện cho doctor; CSKH/Lễ tân không thấy. Title đổi "Lịch hẹn của <short_name>" khi scope=me.
- Verify: tsc --noEmit clean, eslint clean, 8 migration test PASS.
- 🐛 Sửa thêm `.gitignore`: rule `lib/` (Python build artifact) catch nhầm `src/dashboard/lib/` → 2 file existing (supabase-server.ts, supabase-browser.ts) chưa từng được track. Thêm exception `!src/dashboard/lib/**` (commit 379cf97).

### CÒN LẠI CHO DEMO
- **Wet sync full đang chạy** (PID 6965 - bash bqnz916te). Notion API 22 phút trước flaky, kill rồi start lại lúc API hồi (3.6s/page). ETA ~25 phút.
- Operator-side P4 (chỉ user làm được, tôi không có service_role key):
  1. Supabase dashboard → Authentication → Users → Add user cho 2 acc demo: BS Thành (email tuỳ chọn, Auto-confirm), Diệu Hoa (CSKH default).
  2. Copy 2 UUID, chạy: `poetry run python scripts/seed/link_staff_to_auth.py --map "BS Thành=<uid>" --map "Diệu Hoa=<uid>"`.
  3. Login dashboard bằng acc BS Thành → /appointments → toggle "Của tôi" → verify chỉ thấy lịch BS Thành. Login bằng Diệu Hoa → không có toggle (CSKH).
- P5 (DEMO-VERIFY-01): E2E tay — tạo BN test trên Notion → chạy `sync_to_supabase.py` (không có cron Phase 1) → BS Thành login dashboard thấy lịch sau ~30s.
- Cron + incremental sync (P3b) deferred — v1 đủ demo.

### VIỆC NHỎ TỒN ĐỌNG
- 5 dòng CSKH default trong staff cần Tuyền verify role có đúng không (Diệu Hoa, Huyền Diệu, Kim Tiến, Kiều Thủy, Trang A).
- Wet sync kết quả cuối — nếu thành công, Supabase có data thật để verify P4 end-to-end.
- Áp dụng tay 4 RLS migrations vào prod schema (đã apply runtime trong phiên — nhưng migration runner chưa lưu trạng thái vào `schema_migrations`).


## === ĐÓNG PHIÊN 29/5 (phiên dài, ~13 commit) ===

### TRẠNG THÁI CUỐI PHIÊN
- Branch: `feat/t-transform-01`, HEAD = sẽ cập nhật cuối, **13+ commit local chưa push**.
- Wet sync Notion → Supabase **DONE** lần cuối session. Data thật trong Supabase prod:
  - patient = **5803** (5571 complete với DOB+phone, 232 thiếu DOB, 5803 phone unique = không trùng)
  - appointment = **9089** (8151 NO_SHOW lịch sử + 938 SCHEDULED) — 53 hôm nay, 22 ngày mai
  - visit + clinical_record = **5460 cặp**
  - lab_result = **0** (clone đứt relation, EXPECTED)
  - patient_code chạy đúng: BN-2026-000001 → BN-2026-005803
  - review_queue = 233 (same-phone-diff-name), rejects = 16576 (Rx/lab không extract được phone từ link rỗng)
  - Rx 10000 / 15319 — nghi Notion API có soft cap 10k/data_source query, KHÔNG ảnh hưởng demo

### COMMITS SESSION (theo thứ tự)
1. `3ac3e7c` chore(notion): notion-client + schema inspector + report (1762 dòng)
2. `0471000` feat(seed): P1 service_type 14 + staff 40 từ Notion + wipe 30 demo
3. `16ba13b` feat(sec): P2 RLS visit/clinical/lab/appointment + X-API-Key middleware
4. `30c7028` feat(notion-sync): P3 adapter + dry-runnable loader v1
5. `6df6aff` docs(worklog): session 29/5
6. `5721f64` docs(state): refresh row counts
7. `ea819bf` feat(staff): P4 backend migration 025 + link_staff_to_auth CLI
8. `900172a` feat(dashboard): P4 UI per-doctor "Lịch của tôi"
9. `379cf97` chore(gitignore): un-ignore src/dashboard/lib
10. `28d05db` docs(worklog): append P4
11. `75697cd` fix(notion-sync): retry 502 + bump attempts 5→8
12. `36a428d` feat(dashboard): /home + role landing + admin nav + rose theme + realtime

### KIẾN TRÚC ĐÃ CHỐT (giữ làm reference phiên sau)
1. **Source-of-truth = Notion clone** (LINK_NOTION_PAGE_ID workspace Avalook). Không chờ prod token. CSV cũ bỏ.
2. **Pipeline**: Notion API → `notion_to_sources.py` (adapter prop-typed→string, ISO→CSV dd/mm/yyyy) → `transform.py` (clean+MPI+join SĐT, KHÔNG sửa) → `sync_to_supabase.py` (TRUNCATE→INSERT 1 tx).
3. **Notion bug đã fix**: `UnknownHTTPResponseError` (502 Bad Gateway) KHÔNG phải subclass `APIResponseError`; cả 2 cùng parent `HTTPResponseError`. Backoff catch parent + 8 attempts.
4. **Sync wipe-then-insert** trong 1 tx. Đến commit cuối mới có data. Trước đó tables rỗng = đúng design, KHÔNG phải bug.
5. **Dashboard**: Next 16 (proxy.ts, no middleware.ts), Supabase SSR client, page query trực tiếp Supabase qua RLS authenticated. Backend FastAPI chỉ cho write path + agent endpoint.
6. **Phân quyền v1**: `staff.auth_user_id` link Supabase Auth user. `isDoctorRole()` + `isAdminRole()` + `roleLanding()` trong `src/dashboard/lib/current-staff.ts`. Proxy redirect post-login theo dept.
7. **Color**: rose `#ec4899` / `#db2777` thay indigo. Sidebar đen giữ nguyên.
8. **Dùng "Lịch của tôi"**: chỉ BS/BS SA (DOCTOR + ULTRASOUND_DOCTOR). `?scope=me` filter `doctor_id = staff.id`.

### CÒN LẠI CHO DEMO (F1+F2+F3 — đang code ngay sau khi viết block này)
- **F1** Fix login UX: LoginForm hardcoded /work-sessions bypass role-aware → sửa về /login để proxy quyết. Đổi blue-600 → rose. ~30 phút.
- **F2** Forgot password flow: nút "Quên mật khẩu?" → /forgot-password (email input) → Supabase `resetPasswordForEmail` → email link → /reset-password (handle token + updateUser). ~1 buổi.
- **F3** Admin tạo user trong /settings: cần `SUPABASE_SERVICE_ROLE_KEY` trong .env (CHƯA CÓ). Server route handler dùng service role gọi `auth.admin.createUser({email, password})` → trả uuid → UPDATE staff link. Form trong /settings/new-user (chỉ Admin). ~1 ngày.

### VIỆC NGOÀI TẦM DEV (chỉ user/sếp làm được)
- Tạo `SUPABASE_SERVICE_ROLE_KEY` trong Supabase dashboard → paste vào `.env` (cần cho F3).
- Tạo 2 Supabase Auth user demo (BS Thành + Admin) → chạy `link_staff_to_auth.py` link với staff row.
- Sau khi F3 xong, có thể tạo user qua dashboard luôn không cần CLI.
- Verify 5 NV không prefix có role đúng không: Diệu Hoa, Huyền Diệu, Kim Tiến, Kiều Thủy, Trang A (đang default CSKH).

### NỢ KỸ THUẬT BIẾT TRƯỚC (đừng làm Phase 1, ghi để khỏi quên)
- Apply runtime 4 RLS migration 021-024 + migration 025 chưa qua migration runner → `schema_migrations` table chưa ghi. Phase 2 rerun runner sẽ idempotent skip vì pattern `IF NOT EXISTS`.
- Rx 5319 dòng còn trên Notion mà sync chỉ pull 10000 → cần kiểm tra Notion API cap thật hay code bug.
- `lab_result = 0` do clone đứt link. Khi có prod token → relation populated → lab sync được.
- `prescription` TABLE KHÔNG TỒN TẠI trong Supabase → 10000 dòng Rx pulled rồi REJECT trong transform vì không có target.
- Cron incremental sync (P3b) — defer. Hiện chạy tay khi cần update.

### BẮT ĐẦU PHIÊN SAU LÀM GÌ
Đọc CLAUDE.md §1 startup ritual, đọc 3 file ngữ cảnh, đọc block này. Báo cáo 3-5 dòng hiểu hiện trạng. Hỏi user việc tiếp theo. KHÔNG tự push, KHÔNG tự deploy.


## === PHIÊN 29/5 — ĐÓNG CUỐI (E2 + E2c + F-auth + bug ngày) ===

### TRẠNG THÁI CUỐI PHIÊN
- Branch: `feat/t-transform-01`, HEAD = c95178d, **~22 commit local**, đã PUSH lên GitHub cuối phiên.
- Tất cả Phase-1 13/13 bảng có schema. 10/22 bảng có data thật. Tổng ~107k row data thật trên Supabase.
- Dashboard chạy được, branding rose Dr4Women, role-aware landing, account management UI đầy đủ (create + reset + unlink), forgot password flow, login fixed.

### COMMITS PHIÊN (tiếp nối block trước, theo thứ tự)
13. `36a428d` feat(dashboard): /home + role landing + admin nav + rose theme + realtime
14. `244fa4b` docs(worklog): close session 29/5 + plan F1+F2+F3
15. `1a338b9` feat(auth): F1 fix login redirect + theme · F2 forgot/reset password · F3 admin create user
16. `c39f315` feat(schema): close 3 Phase-1 debts (booking_channel, patient_contact_channel, patient_next_of_kin) + seed 7 channels + backfill 5803 PHONE
17. `86f7480` **feat(sync): E2 — switch source từ Notion clone → PK CSV bundle. lab_result: 0 → 4724.** + bake patient_contact_channel backfill vào sync transaction. + operator-authored AccountActions.tsx, management bootstrap seed 008, PATCH method API admin/users.
18. `c95178d` **feat(sync): E2c — 3 bảng mới (cskh_action 31179, service_log 15075, prescription 14300) + fix bug "toàn 29/5" bằng cách dùng Notion "Created time" làm row.created_at.**

### DATA FINAL TRONG SUPABASE (verify thật cuối phiên)
| Bảng | Count | Source |
|---|---|---|
| cskh_action | 31.179 | CSV CSKH Action, 93% linked patient |
| service_log | 15.075 | CSV Dịch vụ, 93% linked |
| prescription | 14.300 | CSV Kê thuốc, 100% linked |
| appointment | 9.170 | CSV Lịch hẹn |
| visit | 5.583 | CSV Phiếu khám (= clinical) |
| clinical_record | 5.583 | CSV Phiếu khám |
| patient | 5.518 | CSV File khách hàng + MPI dedup |
| patient_contact_channel | 5.518 | Backfill từ patient.phone_primary |
| lab_result | 4.724 | CSV Xét nghiệm (clone không lấy được vì relation đứt) |
| staff | 40 | Seed Notion lib 3 |
| service_type | 14 | Seed Notion options |
| booking_channel | 7 | Seed mặc định (ZALO_PK, FB_DR4WOMEN, FB_4WOMEN, FB_ACADEMY, HOTLINE, WALK_IN, REFERRAL) |
| clinic_location | 2 | Seed cũ KN + HN |
| **Tổng row data** | **~107.000** | |

`patient_medical_profile`, `pregnancy`, `patient_next_of_kin`, `work_session`, `work_session_staff`, `event_log` = 0 (schema sẵn, populate runtime hoặc Phase 2).

### TIMESTAMP DISTRIBUTION (verify bug "29/5" fix)
patient.created_at trải:
- 2025-11: 3519 BN (bùng phát đăng kí)
- 2025-12: 304, 2026-01: 307, 2026-02: 132
- 2026-03: 477, 2026-04: 540, 2026-05: 239 (mới)
→ Dashboard "Tạo lúc" giờ chính xác theo thời gian PK thật, không phải import day.

### KIẾN TRÚC CHỐT THÊM SESSION NÀY (carry-over phiên sau)
1. **CSV > Notion clone** cho data import. Lý do: clone đứt relation khi duplicate workspace, CSV PK xuất giữ link text "Name SDT (URL)" → extract_phone recover được. Pipeline mặc định `--source csv` (Notion adapter giữ làm fallback test).
2. **transform.py mở rộng**: thêm `source_created_time` + `source_updated_time` vào Patient dataclass + 4 map_*. Không vi phạm rule "không sửa MPI/clean" — chỉ pass-through metadata cho sync dùng.
3. **csv_to_sources** load 7 datasets (5 cho transform.py + 2 cho post-transform E2c: cskh_action + service).
4. **E2c loaders bypass transform.py**: dùng `_build_phone_index` từ result.patients để resolve clinic_patient_id cho CSKH/Dịch vụ rows. transform.py không cần biết về 2 bảng này.
5. **Dashboard `/api/admin/users`**: 3 method POST/PATCH (reset_password) /PATCH (unlink). Service-role key bypass RLS.
6. **Bootstrap admin**: seed 008 tạo 1 MANAGEMENT staff row. Operator dùng để link Supabase Auth user đầu tiên qua `link_staff_to_auth.py` → mọi user khác qua /settings UI.

### VIỆC THẬT BẠN CẦN LÀM ĐỂ DEMO
1. Lấy `SUPABASE_SERVICE_ROLE_KEY` từ Supabase dashboard → Project Settings → API → service_role secret → paste vào `.env` của repo (KHÔNG commit) → restart dashboard.
2. Supabase Auth → Add user (email + password + Auto-confirm). Copy UUID.
3. `poetry run python scripts/seed/link_staff_to_auth.py --map "Quản trị hệ thống=<uuid>"` (hoặc tên Admin bạn promote).
4. Login dashboard → /settings → Thêm tài khoản → tạo BS Thành / CSKH / etc qua UI.
5. Login bằng BS Thành → auto-redirect /appointments?scope=me → thấy lịch BS Thành hôm nay.

### NỢ KỸ THUẬT (tiếp tục Phase 2)
- `staff_capability`, `staff_task`, `mpi_merge_queue`, `ultrasound_record`, `visit_amendment`, `event_log` = 0 row → populate runtime khi backend agent chạy.
- URL → FK resolution cho `cskh_action.*_link_raw` (currently text). Phase 2 build URL→UUID map, đổi 4 cột link_raw → FK appointment_id / visit_id / lab_result_id / patient_id.
- Service_type alias match: hiện chỉ trim `[TT]/[SA]/[XN]/[KHAM]` prefix. Phase 2 có aliases column trong service_type → match theo nhiều cách viết.
- `work_session` + `work_session_staff`: chưa có nguồn data. Cần PM/sếp chốt cách nhập ca trực.
- Cron incremental sync (P3b) defer khi PK đồng ý live workflow.
- `Phiếu khám` Notion DB có nhiều columns chưa khai thác (Chẩn đoán công khai, Khám-Tư vấn, Loại dịch vụ khám). Phase 2 extend `clinical_record` schema để hứng.

### BẮT ĐẦU PHIÊN SAU LÀM GÌ
Đọc CLAUDE.md §1 → context/CURRENT_PROGRESS.md (block này) → context/SYSTEM_STATE_ACTUAL.md. Báo 3-5 dòng. Hỏi user việc tiếp.

## === PHIÊN 1/6 — APPEND-ONLY GUARD + EVENT_LOG AUDIT cho luồng nhập liệu dashboard ===

### BỐI CẢNH / CÂU HỎI USER
User hỏi: "thao tác nhập liệu dashboard đã lưu Supabase chưa? chuẩn append-only chưa?" → khảo sát thấy:
- 2 endpoint nhập liệu THẬT: `POST /api/patients` (INSERT patient) + `POST /api/appointments` (INSERT appointment), đều qua service-role client (RLS chỉ có SELECT policy).
- ĐÃ lưu Supabase ✓. NHƯNG chưa "chuẩn append-only": chỉ `event_log` có trigger `enforce_append_only` (013/014); dashboard KHÔNG ghi event_log; `patient`/`appointment` là bảng mutable thường, không chặn DELETE/TRUNCATE.
- User chốt: làm CẢ 2 — (A) ghi event_log từ 2 endpoint, (B) guard append-only cho patient/appointment.

### ĐÃ LÀM (đã apply lên Supabase + verify live, data 5518/9170 nguyên vẹn)
1. **Migration `20260601_033_append_only_guard.sql`** (+ down): hàm `prevent_hard_delete()` + 4 trigger chặn DELETE/TRUNCATE trên `patient` & `appointment`.
   - **QUYẾT ĐỊNH: chỉ chặn DELETE/TRUNCATE, KHÔNG chặn UPDATE.** LÝ DO: 2 bảng cần UPDATE cho vòng đời (appointment.status SCHEDULED→…→CANCELLED, patient.is_active). Huỷ = đổi status, không xoá dòng. Chặn UPDATE sẽ làm hỏng app.
   - Đã apply trực tiếp qua asyncpg (KHÔNG dùng `apply_migrations.py` full — 021→032 đang "pending" trong tracker nhưng đã apply out-of-band; chạy full sẽ re-apply RLS `CREATE POLICY` không idempotent → lỗi). Mark riêng 033 bằng `--mark-applied`.
2. **GUC opt-out cho ETL** (`SET LOCAL app.allow_hard_delete='on'`): trigger cho phép DELETE/TRUNCATE khi cờ này = 'on'. LÝ DO: guard sẽ làm hỏng `demo_seed.py --wipe` (DELETE patient) + `sync_to_supabase.py` (TRUNCATE patient/appointment — đúng pipeline LOAD). Đã sửa 2 script set cờ trong cùng transaction. App/dashboard không bao giờ set cờ → vẫn bị chặn.
3. **`src/dashboard/lib/event-log.ts`** (mới): helper `logEvent()` ghi event_log qua service-role client. **Best-effort** (chạy sau business write đã commit; lỗi log không làm hỏng create). LÝ DO: PostgREST không có transaction 2 bảng.
4. **Wire event_log vào 2 route**: `patient.created` + `appointment.created` (payload = snapshot; metadata = clinic_role + clinic_staff_id + actor_auth_user_id + origin). Refactor `doctor_id`/`booking_channel` ra biến để tái dùng.

### VERIFY (đã chạy, trong transaction rollback nên data an toàn)
- DELETE patient/appointment (app, không cờ) → 🔒 BLOCKED (insufficient_privilege, message custom).
- DELETE có cờ opt-out → trigger cho qua (appointment DELETE 1 thành công; patient qua trigger, chỉ vướng FK `visit` — đúng kỳ vọng).
- patient=5518 / appointment=9170 == trước test ✓ (rollback sạch).
- Dashboard: `tsc --noEmit` exit 0, `eslint` exit 0. Scripts: `py_compile` OK.
- KHÔNG bắn event test vào event_log (bảng bất biến, không xoá được dòng rác) → sẽ có event thật khi CSKH dùng dashboard.

### NỢ / LƯU Ý (carry-over)
- **Audit hiện best-effort**, chưa nguyên tử. Muốn đảm bảo 100% mọi INSERT có event → cần trigger AFTER INSERT ở DB hoặc RPC ghi 2 bảng 1 transaction (nhưng DB không biết clinic_staff_id đang thao tác). Treo chờ user quyết.
- **Tracking drift sẵn có**: 021→032 vẫn "pending" trong `schema_migrations` (đã apply out-of-band). Chưa dọn (re-apply RLS không idempotent sẽ lỗi). Muốn sạch → `--mark-applied` từng file đã xác nhận tồn tại.
- Khi dashboard có thêm thao tác UPDATE (đổi status lịch, sửa BN) → nên ghi thêm event tương ứng (`appointment.status_changed`, `patient.updated`) qua cùng `logEvent()`.

## === PHIÊN 1/6 (tiếp) — VERIFY THỜI GIAN ĐỐI CHIẾU CSV + reporting fix ===

### CÂU HỎI: "appointment slot_start đã chuẩn theo CSV phòng khám chưa?" → CHUẨN ✅
Đối chiếu `appointment.slot_start` (Supabase, giờ VN) ↔ CSV "Lịch hẹn"/"Ngày giờ hẹn":
- **Không lệch ngày.** Bug Notion-clone đã khắc phục (chuyển nguồn sang CSV + tag `+07:00` trong `parse_datetime_vn`).
- Bằng chứng: histogram giờ-trong-ngày khớp (18:00→458/431, 18:30→355/334…); date-only→00:00 đúng; phân bố THÁNG khớp ~91% ĐỀU khắp mọi tháng kể cả tương lai → không có shift (shift sẽ làm 1 tháng rỗng + tháng kề phình).
- 471 lịch tương lai (≥01/06/2026) = tái khám date-only THẬT trong CSV (CSV có 521), KHÔNG phải bug.

### FUNNEL appointment (CSV 10032 → Supabase 9170)
- `parse_datetime_vn` OK: 9871 | rỗng "Ngày giờ hẹn" → skip: 161 (booking dở dang: 0 tag giờ, 0 check-in, 157/161 chưa có trạng thái khách đến). **KHÔNG bịa ngày từ Created time** (= làm giả timestamp lâm sàng).
- chênh 701 = BN không resolve được SĐT (MPI review-conflict, `rc_ids`). Overlap trùng giờ bác sĩ **KHÔNG bỏ** → vẫn insert, NULL `doctor_id`.
- Dòng 1989 (`28/04/1989`) + 2027 (`10/04/2027`): **có y nguyên trong CSV** → typo tại nguồn, import trung thực.
- Format range `"29/03/2026 → …"`: `_DATETIME_RE.search` bắt cụm đầu → `2026-03-29`. Parser xử ĐÚNG — KHÔNG cần fix (báo "7 dòng lỗi" trước là báo động giả của regex phân tích chặt hơn).

### REPORTING FIX — `_insert_appointments` (sync_to_supabase.py)
- BUG phát hiện: biến `skipped` (a) đếm cả overlap-nulled rows (vốn ĐÃ được insert) → sai ngữ nghĩa; (b) là **biến chết** — caller nhận rồi vứt, `_render_report` không dùng, dù comment khoe "report surfaces the volume".
- FIX: tách 3 counter `skipped_no_patient` / `skipped_no_slot` / `doctor_nulled` + thêm log `appointment_load_summary inserted=.. skipped_no_patient=.. skipped_no_slot=.. doctor_nulled_on_overlap=..` (%-style vì `logger` là stdlib). Caller dùng `_`. **KHÔNG đổi hành vi load / data** — chỉ làm báo cáo skip chính xác & thực sự hiện ra. compile+ruff sạch, transform test 20/20 pass.

### VERIFY TIMESTAMPS visit / lab / cskh đối chiếu CSV — XONG ✅ (tất cả chuẩn, 0 shift)
- `_parse_dt_loose` xử lý đúng cả format English Notion (`"November 14, 2025 7:52 AM"` → `+07:00`).
- **visit.created_at** ← clinical "Created time": phân bố khớp CSV ~85-92% ĐỀU mọi tháng, 0 tháng-ma → không shift.
- **lab_result.created_at** ← lab "Created time": khớp ~92-97% đều, 0 tháng-ma.
- **cskh_action.source_created_at** ← cskh "Giờ khởi tạo": load 31179/31179, phân bố khớp **100% mọi tháng**.
- **KIỂM CHỨNG VÀNG (join theo `//ID`=`source_ref`=ACT-n): 31179/31179 timestamp khớp CHÍNH XÁC tới phút** (vd CSV `08:19+07` = Sup `01:19+00`, đúng cùng thời điểm + timezone). → `+07:00` tagging đúng tuyệt đối.
- KẾT LUẬN TOÀN CỤC: mọi cột thời gian (appointment/visit/lab/cskh + patient.created_at) **trung thực với CSV, bug Notion-clone đã khắc phục hoàn toàn**. Sẵn sàng cho phòng khám test thật trên Vercel.

## === PHIÊN 01/06 — DEPLOY VERCEL THẬT + FIX RLS DROPDOWN + ĐẶT LỊCH BN CÓ SẴN ===
> Bối cảnh: phòng khám bắt đầu test thật trên Vercel. Gỡ 3 lỗi liên tiếp.

### 1. Dashboard không chạy trên Vercel → ĐÃ CHẠY
Chuỗi nguyên nhân (gỡ từng lớp):
- `output:"standalone"` phá routing Vercel (404 mọi route). Đã gate `!process.env.VERCEL` (commit a745cf5, có sẵn trên branch).
- Repo Vercel nối = **Avalook/Clinic-AI-Dr4Women** (private), default branch = **feat/t-transform-01** — repo này **KHÔNG có branch `main`**. Production branch = feat/t-transform-01.
- Tạo lại project qua Import: Root Directory=`src/dashboard`, Framework Preset=**Next.js**. LỖI CHÍNH: ban đầu Preset để trống → Vercel deploy như static rỗng → 404 cả file tĩnh (`/_next/*`, favicon). **KHÔNG phải "proxy Next-16 không chạy được trên Vercel"** như commit e69235c phỏng đoán → e69235c chẩn nhầm rồi rẽ sang Render. 4 env vars (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY + CLINIC_SHARED_EMAIL) set Production+Preview.
- QUYẾT ĐỊNH: **ở lại Vercel** (bỏ hướng Render của e69235c). Proxy Next-16 chạy bình thường trên Vercel sau khi Preset đúng + đủ env.

### 2. ⚠️ SỬA CHỖ GHI SAI: migration 032 THỰC RA CHƯA APPLY (trái với dòng 480/494)
- Triệu chứng: dropdown "Cơ sở" rỗng khi thêm BN → submit báo "Phải chọn cơ sở".
- Verify DB thật (`pg_policies`): **0 policy** trên clinic_location/service_type/staff/pregnancy → RLS bật nhưng KHÔNG có policy → mọi read `authenticated` = 0 dòng (đúng bug mà 032 mô tả).
- → Dòng 480/494 ("021→032 đã apply out-of-band") **SAI đối với 032**. 032 thực tế MỚI chạy 01/06 qua Supabase SQL Editor (4 policy `*_select_authenticated USING(true) TO authenticated`). `schema_migrations` vẫn chưa `--mark-applied` 032.
- BÀI HỌC: đúng cảnh báo CLAUDE.md §3 — không tin doc/worklog, verify DB thật. Sau fix: dropdown cơ sở/dịch vụ/bác sĩ đều lên, tạo BN OK.

### 3. TÍNH NĂNG MỚI: đặt lịch cho BN CÓ SẴN (trước chỉ đặt được trong luồng tạo BN mới)
- Backend đã đủ (`POST /api/appointments`), chỉ thiếu UI/đường vào.
- Tách form đặt lịch (bước 2 NewPatientForm) → component dùng chung `app/(dashboard)/patients/AppointmentBooking.tsx` (chỉ render form + callback `onBooked`). NewPatientForm refactor dùng lại → **bỏ ~100 dòng trùng**.
- `app/(dashboard)/patients/[id]/PatientBooking.tsx` (mới): nút "+ Đặt lịch hẹn" trên hồ sơ BN; đặt xong `router.refresh()` để bảng "Lịch sử lịch hẹn" cập nhật. `page.tsx` load dropdown + render **chỉ khi `canWriteIntake`** (CSKH/Lễ tân/Quản lý) — bác sĩ chỉ xem. QUYẾT ĐỊNH vị trí: nút trên hồ sơ BN (không thêm trang/nav mới).
- Tiện thể đổi `useExisting`→`pickExisting` (fix lỗi eslint `rules-of-hooks` CÓ SẴN từ HEAD — Next 16 bỏ `next lint` nên build không bắt).
- VERIFY: `tsc --noEmit`=0, `eslint`=0, `VERCEL=1 next build` OK. **KHÔNG** test booking thật lên prod (migration 033 append-only chặn DELETE → tránh để data rác không gỡ được).

### NỢ / CARRY-OVER
- `schema_migrations` chưa ghi 032 (đã apply tay) → cần `--mark-applied` 032 cho sạch tracker.
- Tính năng booking mới: đã commit + push lên avalook + origin (Vercel deploy). Đã chạy thật OK.

## === PHIÊN 01/06 (tiếp) — BÁC SĨ XÁC NHẬN / TỪ CHỐI LỊCH HẸN ===
> Yêu cầu: BS xem "Lịch của tôi" cần nút Xác nhận/Từ chối lịch chờ. Từ chối = không nhận BN (phân BS khác SAU — hoãn). Thông báo cho Lễ tân/CSKH/QL. Lịch sử BS vẫn hiện BN đã từ chối.

### ĐÃ LÀM (code + migration; **034 CHƯA apply lên DB**)
- **Migration 034** (`20260601_034_appointment_doctor_declined.sql`): thêm `DOCTOR_DECLINED` vào CHECK `appointment_status_check` (DROP+ADD, idempotent). **Phải chạy SQL Editor** thì nút "Từ chối" mới hoạt động; "Xác nhận"→CONFIRMED chạy luôn không cần.
- **API** `PATCH /api/appointments` `{id, action: confirm|decline}`: chỉ `isDoctorRole` + chỉ lịch `doctor_id = staff.id` + `status=SCHEDULED`. confirm→CONFIRMED, decline→DOCTOR_DECLINED. Ghi `event_log` (appointment.confirmed/declined). UPDATE KHÔNG bị guard 033 chặn (033 chỉ chặn DELETE/TRUNCATE).
- **UI**: nút Xác nhận(xanh)/Từ chối(đỏ) `AppointmentActions` trên tab "Chờ xác nhận", chỉ hiện cho BS + lịch của chính mình. Tab mới **"Đã từ chối"** (DOCTOR_DECLINED) — BS scope=me thấy lịch mình từ chối, Lễ tân/CSKH scope=all thấy hàng đợi cần phân lại. Badge "Đã từ chối" (cam) trong StatusBadge.
- **Thông báo**: toast góc trên-phải có nút ✕ (`DeclinedNotice`) trong dashboard layout, cho `canWriteIntake` (Lễ tân/CSKH/QL), liệt kê lịch DOCTOR_DECLINED từ hôm nay trở đi. Dismiss = theo session (reload lại hiện nếu còn).
- VERIFY: tsc=0, eslint=0, VERCEL=1 build OK. KHÔNG test decline thật lên prod (034 chưa apply + tránh data rác do guard 033).

### NỢ / CARRY-OVER
- **Apply migration 034** lên prod (SQL Editor) — chưa làm; "Từ chối" chưa chạy tới khi apply.
- **Cơ chế phân lại BS khác** (DOCTOR_DECLINED → SCHEDULED + đổi doctor_id) — HOÃN theo yêu cầu user.
- `schema_migrations`: 032 + 034 đều apply tay ngoài runner → cần `--mark-applied` cho sạch tracker.
