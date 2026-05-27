# ClinicAI — Handoff Worklog
> Cập nhật: 2026-05-27 (cuối session) · Dev: Tuyền (solo) · Executor: Claude Code
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

### LƯU Ý CHO PHIÊN SAU
- Registry mới này là điểm vào để orchestrator/agent liệt kê tool gọi Claude API (to_anthropic_tools). communication.send_zalo vẫn [STUB].
- Nếu sau này muốn import eager toolset ở tools/__init__: phải gỡ vòng services↔tools._common (vd dời TraceContext ra clinicai.core) — hiện lazy-load né được, chưa cần.
- Dashboard ghi (form CSKH) vẫn GÁC theo quyết định 26/5 (Notion = nguồn, dashboard chỉ đọc).
