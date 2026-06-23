# Task Packet — T-FORM-COMPACT-02: TAB hoá PHIẾU KHÁM BỆNH (giảm cuộn) — file ĐÚNG

> Dành cho Claude Code (VSCode). Đọc HẾT trước khi code. Đây là **bản sửa scope của T-FORM-COMPACT-01**:
> lần trước nhắm nhầm `ServiceFormEngine.tsx` (chỉ là 1 khối nhỏ ở đáy). Phiếu DÀI mà bác sĩ/TKYK
> thật sự cuộn là **`ClinicalRecordForm.tsx`**. Lần này nhắm đúng nó.
> Người giao: Quang (qua phiên Claude web). 2026-06-23.

---

## 0. BỐI CẢNH + RÀNG BUỘC (vi phạm là hỏng)

- **Vấn đề PM:** "PHIẾU KHÁM BỆNH" quá dài (I Hành chính → Sinh hiệu → II Lý do → … → X Tái khám → Phiếu chuyên khoa → nút Lưu ở tận đáy) → bác sĩ/TKYK phải **cuộn nhiều** khi vội. Yêu cầu: **GIỮ ĐỦ mọi mục + mọi trường**, gần như **hết cuộn**. **CHỈ đổi CÁCH HIỂN THỊ, KHÔNG đổi dữ liệu/logic.**
- **Nhánh:** chỉ `chinh`. Đầu phiên `git branch` xác nhận. KHÔNG đụng `feat/t-transform-01`. Commit **local --no-verify** (hook hỏng), **KHÔNG push**.
- **Next.js 16.2.6 (breaking changes):** đọc `node_modules/next/dist/docs/` phần liên quan trước khi viết. Đây là client component React thường.
- **File DUY NHẤT được sửa:** `src/dashboard/app/(dashboard)/tasks/ClinicalRecordForm.tsx`.
  - KHÔNG sửa `ServiceFormEngine.tsx` (đã tab hoá xong ở T-FORM-COMPACT-01 — giữ nguyên, nó là 1 card tự quản).
  - KHÔNG sửa `SonoBiometry.tsx`, `PreVisitBrief.tsx`, các API, các schema, `lib/*`.
  - KHÔNG đụng file Quang đang dở: `Nav.tsx`, `Shell.tsx`, `nav-items.ts`, `patients/new/*`, `api/appointments/route.ts`, migration `057_*`. Khi commit chỉ `git add ClinicalRecordForm.tsx` (KHÔNG `git add -A`).
- **TUYỆT ĐỐI GIỮ NGUYÊN (chỉ bọc lại JSX, không viết lại logic):**
  - Mọi mục I→X + Sinh hiệu + Phiếu chuyên khoa + mọi field/checkbox/textarea (đủ trường).
  - Hàm `save()`, `saveVitals()`, `orderLab()`, prefill `readDraft()`, payload, hợp đồng `soap_plan.tai_kham` `{ngay, xn[], ghi_chu}`.
  - Các chế độ: `readOnly`, `vitalsOnly`, `viewingPast` (pager), `locked` (FINALIZED), `roRest`, `canEditAdmin`, `showPreVisitBrief`, `showSono`, `showRebook`, `enableVisitPager`. Field nào đang `disabled` theo chế độ nào thì GIỮ NGUYÊN.
  - Component `Section` (line ~193–210) — DÙNG LẠI y nguyên bên trong panel tab.

---

## 1. BẢN ĐỒ HIỆN TRẠNG (đã khảo sát — khỏi dò lại)

File `ClinicalRecordForm.tsx` (~1158 dòng). Render dọc liên tục (gây cuộn). Thứ tự khối trong JSX return:

| Line | Khối | Render | Điều kiện |
|---|---|---|---|
| 601–653 | **Header "Phiếu khám bệnh" + Pager ◀▶** | JSX | pager khi `enableVisitPager && pages>1` |
| 656–669 | Banner cảnh báo (👁 chỉ xem / 🔒 đã chốt / 🕓 chờ check-in) | JSX | theo `readOnly`/`locked`/`arrivalPending` |
| 672–708 | **I Hành chính** | `Section` | luôn |
| 712–715 | Tóm tắt trước khám | `<PreVisitBrief>` | `showPreVisitBrief` |
| 720–726 | Số đo siêu âm thai | `<SonoBiometry>` | `showSono && !viewingPast` |
| 729–763 | Lịch sử khám trước (collapsible) | `<details>` | `data.history.length>0` |
| 766–823 | **Sinh hiệu** (BẮT BUỘC: huyet_ap, can_nang, chieu_cao) | `Section` | luôn |
| 828–830 | **II Lý do khám** | `Section` | luôn (ĐD đón-khám cũng sửa) |
| 832–839 | **III Tiền sử dị ứng** | `Section` | luôn (roRest) |
| 842–873 | **IV Tiền sử (mạn/PT/thuốc/gia đình)** | `Section` | luôn (roRest) |
| 875–918 | **V Bệnh sử & khám thai** | `Section` | luôn (roRest) |
| 920–978 | **VI Kết quả cận lâm sàng** (+ ô "Chỉ định CLS" `orderLab`) | `Section` | luôn; ô chỉ định ẩn khi vitalsOnly/readOnly |
| 980–982 | **VII Chẩn đoán** | `Section` | luôn (roRest) |
| 984–986 | **VIII Hướng xử lý & lời dặn** | `Section` | luôn (roRest) |
| 988–1049 | **IX Đơn thuốc** (bảng Rx +/-) | `Section` | `!vitalsOnly` |
| 1052–1098 | **X Theo dõi & Tái khám** | `Section` | luôn (roRest) |
| 1100–1111 | **Phiếu chuyên khoa** | `<ServiceFormEngine>` | `!vitalsOnly && serviceCode && visit_id` |
| 1114–1158 | **Footer: Lưu hồ sơ / Tái khám / Đóng** | JSX | Lưu ẩn khi `readOnly\|\|vitalsOnly\|\|viewingPast` |

State (global useState, KHÔNG mất khi tab hoá): `data, loading, f, pm, tk, rx, drugOpts, clsOpts, labOrder, saving, msg, vitalsTried, pageIdx, viewingPast, pages`.
Required vitals: `REQUIRED_VITALS` (line ~86–90) = huyet_ap, can_nang, chieu_cao; thiếu → `setVitalsTried(true)` + border đỏ (line ~794).
`fill` (SplitPane) → container `h-full` + có `overflow-y-auto` ở line ~655.

---

## 2. VIỆC CẦN LÀM

### A. (BẮT BUỘC) Gom mục thành 4 TAB
Giữ TẤT CẢ mục, gom theo luồng khám lâm sàng thành **4 tab**:

1. **Hành chính & Tiền sử** → I Hành chính · III Tiền sử dị ứng · IV Tiền sử (mạn/PT/thuốc/gia đình).
2. **Khám** → Sinh hiệu · II Lý do khám · V Bệnh sử & khám thai · (`SonoBiometry` nếu `showSono`).
3. **Cận lâm sàng & Chuyên khoa** → VI Kết quả CLS · `ServiceFormEngine` (giữ nguyên — card tự có tab riêng; nested OK vì là card biệt lập).
4. **Chẩn đoán & Xử trí** → VII Chẩn đoán · VIII Lời dặn · IX Đơn thuốc · X Tái khám.

Cách làm (BỌC, không viết lại): thêm state `const [tab,setTab]=useState(0)`. Tạo mảng 4 panel; mỗi mục `<Section>`/khối hiện tại **giữ NGUYÊN nội dung + điều kiện**, chỉ đặt vào panel tương ứng. Chỉ render panel `tab` đang chọn (các panel khác không render DOM — state vẫn ở global useState nên không mất gì).

### B. (BẮT BUỘC) Bố cục "khung cố định, chỉ ruột cuộn"
Panel = flex-col 3 lớp:
- **Trên (cố định):** Header + Pager + Banner cảnh báo + **thanh TAB** (sticky). PreVisitBrief để Ở ĐÂY (trên tab) hoặc trong tab 1 — chọn 1, miễn vẫn mở được.
- **Giữa (CUỘN):** chỉ nội dung tab đang chọn (`overflow-y-auto`).
- **Dưới (cố định, LUÔN hiện):** Footer Lưu/Tái khám/Đóng — **không phải cuộn xuống đáy** mới thấy nút Lưu. (Đây là 1 lợi ích chính.)
Thanh tab có dấu ✓ nhỏ nếu tab đó đã có field điền (tuỳ chọn, nếu dễ).

### C. (BẮT BUỘC) Validation vẫn báo đúng dù field ở tab khác
- Khi `save()`/`saveVitals()` phát hiện thiếu **REQUIRED_VITALS** → ngoài `setVitalsTried(true)`, phải **tự chuyển sang tab "Khám"** (tab chứa Sinh hiệu) để bác sĩ thấy ô đỏ. (Nếu không, bấm Lưu ở tab khác sẽ "im lặng".)
- Thông báo `msg` (lưu ok/lỗi) đặt cạnh Footer (luôn thấy).

### D. (TÙY CHỌN, stretch) Gọn thêm
- Field ngắn trong 1 mục: cho grid lên `lg:grid-cols-3` (như đã làm ở ServiceFormEngine) nếu mục đó toàn field ngắn. textarea/fullWidth vẫn trọn hàng.
- checkbox nhóm XN ở mục X (HM/SH/SA/DXA/PS) có thể đổi sang "chip" cho gọn — nếu rủi ro thấp. Không thì bỏ.

---

## 3. KHÔNG LÀM
- KHÔNG bỏ/đổi field, mục, `field.key`, payload, API, hợp đồng dữ liệu.
- KHÔNG sửa ServiceFormEngine/SonoBiometry/PreVisitBrief/Section logic.
- KHÔNG đổi hành vi các chế độ (readOnly/vitalsOnly/viewingPast/locked) — chỉ đặt lại vị trí hiển thị.
- KHÔNG prefill tiền sử mới / auto-BMI (task khác). KHÔNG push.

---

## 4. KIỂM CHẾ ĐỘ (bắt buộc thử đủ — đây là form quan trọng)
Build + chạy thử từng vai/chế độ (mở qua "Công việc của tôi" → mở hồ sơ BN):
- **Bác sĩ, BN đã check-in:** đủ 4 tab, điền sinh hiệu thiếu → bấm Lưu → tự nhảy tab Khám + ô đỏ. Điền đủ → Lưu OK (và "Lưu & Khám xong" nếu có chẩn đoán+lời dặn).
- **FINALIZED (locked):** mọi tab chỉ xem, không có nút Lưu.
- **Lễ tân (readOnly):** chỉ xem, chuyển tab được, không Lưu.
- **Điều dưỡng (vitalsOnly):** mặc định vào tab "Khám", chỉ Sinh hiệu sửa được, nút "Lưu sinh hiệu" hiện; mục II–X chỉ xem; IX Đơn thuốc + Phiếu chuyên khoa ẩn (đúng như cũ).
- **Pager (enableVisitPager):** ◀▶ đổi lượt khám vẫn chạy; lượt cũ = viewingPast (ẩn Lưu).
- **showSono / showRebook / showPreVisitBrief:** vẫn hiện đúng chỗ.

## 5. VERIFY (từ `src/dashboard`)
```
cd src/dashboard
npx tsc --noEmit     # No errors
npx eslint "app/(dashboard)/tasks/ClinicalRecordForm.tsx"   # No issues (file mình)
npm run build        # Compiled successfully (exit 0)
```

## 6. COMMIT (local trên `chinh`, KHÔNG push)
- `git add` CHỈ `src/dashboard/app/(dashboard)/tasks/ClinicalRecordForm.tsx`. KHÔNG `-A`.
- `git commit --no-verify -m "feat(clinical-form): TAB hoá phiếu khám bệnh (4 tab) + footer Lưu cố định (giảm cuộn)"` kèm dòng cuối:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## 7. BÁO CÁO 5 dòng + cập nhật `context/CURRENT_PROGRESS.md` (thêm mục T-FORM-COMPACT-02 vào block phiên 2026-06-23) → commit local.
Nêu: 4 tab gom thế nào · footer cố định · validation auto-nhảy tab · các chế độ test ra sao · tsc/lint/build · commit hash · CHƯA push.

---

## 8. RỦI RO (đọc kỹ — dễ vỡ)
1. **Validation tab khác:** đã xử ở mục C (auto chuyển tab Khám khi thiếu vitals). Bắt buộc.
2. **vitalsOnly:** ĐD chỉ sửa Sinh hiệu — mặc định mở tab "Khám"; các tab khác vẫn render nhưng field giữ `disabled` như cũ (đừng cho sửa).
3. **locked/FINALIZED + viewingPast:** chỉ xem — đảm bảo nút Lưu vẫn ẩn đúng, mọi field disabled.
4. **ServiceFormEngine** tự fetch riêng, có tab riêng → để nguyên trong tab 3 (nested chấp nhận được). Truyền prop `readOnly={readOnly || locked}` Y NHƯ hiện tại.
5. **orderLab (Chỉ định CLS)** cập nhật mục VI: nếu đang ở tab khác sẽ không thấy ngay — chấp nhận (cùng tab 3 với VI); không cần toast.
6. **Layout `fill`/SplitPane:** giữ chiều cao khung cha; chuyển `overflow-y-auto` về lớp GIỮA (ruột tab), không để cả phiếu cuộn. Header/tab/footer không cuộn mất.
7. Diff phải **tối thiểu & surgical**: chỉ thêm tab state + UI tab + bọc panel + chuyển overflow + auto-switch validation. KHÔNG refactor save/prefill/pager.
