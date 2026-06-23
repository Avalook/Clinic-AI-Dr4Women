# Task Packet — T-FORM-COMPACT-01: Form khám "ÍT CUỘN"

> Dành cho Claude Code (VSCode). Đọc HẾT file này trước khi code. Làm theo đúng các Step.
> Người giao: Quang (qua phiên Claude web). Ngày: 2026-06-23.

---

## 0. BỐI CẢNH + RÀNG BUỘC (đọc kỹ, vi phạm là hỏng)

- **Vấn đề PM nêu:** Phiếu khám chuyên khoa quá dài → bác sĩ / thư ký y khoa phải **cuộn nhiều** khi điền lúc vội. Cần: **giữ ĐỦ trường thông tin** nhưng **gần như hết cuộn**.
- **Nhánh:** chỉ làm trên `chinh`. Đầu phiên chạy `git branch` xác nhận đang ở `chinh`. **KHÔNG** đụng/commit `feat/t-transform-01`. Commit **local**, **KHÔNG push** (push chỉ khi Quang nói "OK").
- **Next.js 16.2.6 có breaking changes** → đọc `node_modules/next/dist/docs/` phần liên quan TRƯỚC khi viết code (xem `src/dashboard/AGENTS.md`). Đây là client component React bình thường, nhưng vẫn tuân thủ.
- **File DUY NHẤT được sửa:** `src/dashboard/app/(dashboard)/tasks/ServiceFormEngine.tsx` (engine render form). Có thể thêm class dùng chung vào `src/dashboard/app/(dashboard)/tasks/form-ui.ts` nếu cần.
- **TUYỆT ĐỐI KHÔNG:**
  - KHÔNG sửa 5 file schema `lib/form-schemas/{pk,sk,nt,hmvs,nk}.ts` (giữ `form_data` tương thích).
  - KHÔNG đổi `field.key`, KHÔNG bỏ field nào (giữ đủ trường — đúng yêu cầu PM).
  - KHÔNG đổi API `/api/clinical-form`, KHÔNG đổi hợp đồng dữ liệu `form_data` phẳng `{ [key]: value }`.
  - KHÔNG đụng các file Quang đang code song song: `nav-items.ts`, `patients/new/*`, `api/appointments/route.ts`, migration `057_*`.
- **Mục tiêu = đổi CÁCH HIỂN THỊ, KHÔNG đổi DỮ LIỆU.**

---

## 1. HIỆN TRẠNG (đã khảo sát sẵn — khỏi dò lại)

`ServiceFormEngine.tsx`:
- Là **engine config-driven**: `getFormSchema(serviceCode)` → `schema.sections[].fields[]` → tự sinh form. Sửa engine = **cả 5 form hưởng**.
- Hiện render **MỌI section xếp dọc** (`<div className="space-y-4">` ... `schema.sections.map(...)`) → đó là nguyên nhân form dài phải cuộn.
- Mỗi section đã là `grid grid-cols-1 sm:grid-cols-2` (đã 2 cột ở desktop).
- Component con `Field` switch theo `field.type`: `textarea | conditional | number(+unit) | date | radio | checkbox | checkbox_group | text`. `radio` và `checkbox_group` đang render **list checkbox/radio DỌC** (`flex flex-wrap gap-x-4 gap-y-1`).
- `isVisible(field, values)` xử lý field điều kiện (`field.parent`). Giá trị lưu ở state `values` (giữ nguyên dù section không hiển thị → an toàn khi ẩn section).
- `readOnly=true` (visit FINALIZED) → khóa nhập; route cũng chặn 409. **Phải giữ.**
- Nút "Lưu phiếu" hiện ở **đáy** (phải cuộn xuống mới thấy).
- Theme: tiêu đề section màu `#9d2463` (hồng), nút lưu `#7c3aed` (tím), accent input `#ec4899`.
- Types: `lib/form-schemas/types.ts` (FieldType, FormField, FormSection, FormSchema, FormData, FieldValue).

---

## 2. VIỆC CẦN LÀM

### A. (BẮT BUỘC) Chia TAB theo section — đòn chính giảm cuộn
- Thêm state `activeIdx` (mặc định 0).
- Render **thanh tab** ngang (cuộn ngang được nếu nhiều): mỗi section 1 nút = `section.title`. Tab active highlight (nền hồng nhạt + chữ `#9d2463`, đậm 500). Tab dính trên cùng phần form (sticky nếu dễ; không thì để đầu khối).
- **Chỉ render fields của section đang active** (các section khác không render DOM nhưng `values` vẫn giữ → không mất dữ liệu, không mất field điều kiện chéo section).
- **Thanh điều hướng dưới (luôn hiển thị):** `← Mục trước` · `Mục i/N · <title>` · `Mục sau →`. Đưa **nút "Lưu phiếu" vào thanh này** để luôn bấm được, không phải cuộn xuống đáy.
- Trên mỗi tab: nếu section đã có ≥1 field được điền (giá trị truthy / mảng có phần tử / số) → hiện chấm hoặc dấu ✓ nhỏ (gợi tiến độ). (Helper: tính nhanh từ `values` + `section.fields[].key`.)
- Khi `readOnly` vẫn cho chuyển tab xem; ẩn nút Lưu (như hiện tại).

### B. (BẮT BUỘC) `radio` + `checkbox_group` → dạng "CHIP" (pill bấm chọn)
- Thay list dọc bằng các **chip** (nút bo tròn) wrap nhiều cột → cắt chiều cao 2–3 lần.
- `radio`: chip — chọn 1 (bấm chip = set value, chip active đổi nền).
- `checkbox_group`: chip — chọn nhiều (toggle, dùng `onToggleGroup` sẵn có).
- Chip active: nền hồng nhạt + chữ đậm (đồng bộ theme). Disabled (readOnly) → mờ, không bấm.
- Giữ nguyên logic value (radio = string; group = string[]) để `form_data` không đổi.

### C. (NÊN) Gọn field ngắn
- Field `number` / `text` ngắn: cho phép grid section lên **3 cột** ở màn rộng (`sm:grid-cols-2 lg:grid-cols-3`) để sinh hiệu (Mạch, HA, Nhiệt độ, Nhịp thở, Cân nặng…) gói gọn theo hàng ngang. `textarea`/`conditional`/`fullWidth` vẫn chiếm trọn hàng (`col-span` đầy đủ — nhớ cập nhật theo số cột mới).

### D. (TÙY CHỌN — stretch, làm nếu còn thời gian)
- Nút **"Tất cả bình thường"** đầu mỗi section: với các field `radio`/`checkbox_group` có option label/value khớp "Bình thường"/"BT"/"Không" → set về giá trị đó. Nếu logic dò option phức tạp → **BỎ QUA**, ghi `// TODO` + báo ở report. ĐỪNG hard-code theo schema cụ thể.

---

## 3. KHÔNG LÀM (ngoài scope task này)
- KHÔNG prefill tiền sử từ hồ sơ BN (cần wiring data — task khác).
- KHÔNG auto-tính BMI (cần biết key chiều cao/cân nặng — task khác).
- KHÔNG đổi schema, KHÔNG thêm/bớt field, KHÔNG đổi API, KHÔNG push.

---

## 4. VERIFY (bắt buộc, từ thư mục `src/dashboard`)
```
cd src/dashboard
npx tsc --noEmit      # phải: No errors
npm run lint          # phải: No issues
npm run build         # phải: Compiled successfully (exit 0)
```
Nếu chạy được app (`npm run dev`): mở 1 phiếu khám (vào "Công việc của tôi" → mở hồ sơ BN có dịch vụ PK/SK/NT/HMVS), kiểm: bấm qua lại các tab OK · chip chọn được (radio 1, group nhiều) · field điều kiện vẫn hiện đúng · Lưu được · mở phiếu FINALIZED thì khóa nhập.

## 5. COMMIT (local trên `chinh`, KHÔNG push)
- `git add` CHỈ `src/dashboard/app/(dashboard)/tasks/ServiceFormEngine.tsx` (+ `form-ui.ts` nếu có sửa). KHÔNG `git add -A` (tránh dính file của Quang).
- Pre-commit hook đang hỏng → commit kèm `--no-verify`.
- Message: `feat(clinical-form): form khám chia tab + chip chọn nhanh (giảm cuộn)` kèm dòng cuối:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## 6. BÁO CÁO (5 dòng)
Đã đổi gì (A/B/C, D có làm không) · kết quả tsc/lint/build · TODO còn lại · commit hash · nhắc "chưa push, chờ Quang duyệt".
Cuối phiên: cập nhật `context/CURRENT_PROGRESS.md` (thêm mục T-FORM-COMPACT-01 vào block phiên 2026-06-23) → commit local.

---

## 7. Ý ĐỒ THIẾT KẾ (6 sáng kiến — để hiểu "vì sao")
1. **Tab theo mục** (A) — mỗi tab ~1 màn → hết cuộn. *(lợi ích lớn nhất)*
2. **Chip thay checkbox dọc** (B) — cắt chiều cao 2–3 lần.
3. **Field ngắn xếp nhiều cột** (C) — sinh hiệu 1 hàng.
4. **"Tất cả bình thường"** (D) — bác sĩ chỉ sửa cái bất thường.
5. Prefill tiền sử (NGOÀI scope — task sau).
6. Auto-lưu + nút Lưu luôn hiển thị (A: đưa nút Lưu lên thanh nav) — không cuộn xuống đáy để lưu.

Giữ ĐỦ trường (không bỏ field nào) — chỉ đổi cách trình bày. Vì engine config-driven nên 1 lần sửa → PK/SK/NT/HMVS/NK đều đẹp.
