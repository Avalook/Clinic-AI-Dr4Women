# Hướng dẫn: Quản lý tài khoản đăng nhập Dashboard

> File này hướng dẫn **cài đặt + dùng** tính năng quản lý tài khoản (login) của
> dashboard Dr4Women. Code dashboard nằm ở `src/dashboard/`.
> Cập nhật: 2026-05-29.

---

## 1. Tóm tắt — tính năng làm được gì

Dashboard tự quản lý **đăng nhập / tạo tài khoản** ngay trong app, **không cần
vào console Supabase** sau khi cấu hình xong. Người quản lý (Admin) có thể:

- Xem danh sách toàn bộ nhân viên + trạng thái đã có tài khoản login chưa.
- **Tạo** tài khoản đăng nhập mới cho 1 nhân viên (email + mật khẩu tạm).
- **Đặt lại mật khẩu** cho 1 nhân viên.
- **Gỡ tài khoản** (thu hồi quyền đăng nhập) của 1 nhân viên.

Nhân viên tự **quên/đặt lại mật khẩu** qua email. Phòng khám **không** mở đăng ký
công khai — tài khoản chỉ do Admin tạo (an toàn cho dữ liệu y tế).

---

## 2. Nền tảng — vì sao GIỮ Supabase Auth (không tự viết auth)

Tài khoản login chạy trên **Supabase Auth**. Mỗi tài khoản = 1 Supabase Auth user,
link **1-1** với 1 dòng nhân viên trong bảng `staff` qua cột `staff.auth_user_id`.

**Không nên bỏ Supabase Auth để tự viết** vì:
- Toàn bộ bảo mật đọc dữ liệu bệnh nhân (RLS trên 5 bảng PII) dựa vào `auth.uid()`
  và role `authenticated` của Supabase. Bỏ Supabase Auth = phải viết lại toàn bộ RLS.
- Phải tự làm: hash mật khẩu, phiên/JWT, email đặt lại mật khẩu… → tốn công, dễ
  hở bảo mật.

→ Supabase Auth là "động cơ"; phần quản lý tài khoản (UI này) là "bảng điều khiển"
phía trên. Cái bạn cần ("tự quản lý đăng nhập/đăng ký") đạt được mà **không** phải
bỏ Supabase Auth.

---

## 3. Phân quyền (vai trò)

Vai trò lấy từ cột `staff.primary_department`:

| Vai trò | Landing sau login | Quyền đặc biệt |
|---|---|---|
| `MANAGEMENT` (Quản lý) | `/home` | **Thấy menu Cài đặt + Báo cáo. CHỈ vai trò này tạo/sửa tài khoản.** |
| `DOCTOR` / `ULTRASOUND_DOCTOR` (Bác sĩ) | `/appointments?scope=me` | Xem lịch của riêng mình |
| `CSKH` | `/tasks` | — |
| `NURSE_ULTRASOUND` / `RECEPTION` / khác | `/home` | — |

- Cổng kiểm tra đăng nhập: `src/dashboard/proxy.ts` (Next.js 16 — dùng `proxy.ts`,
  **không** có `middleware.ts`). Chưa đăng nhập mà vào trang trong `(dashboard)` →
  tự chuyển về `/login`. Đăng nhập rồi → điều hướng theo vai trò.
- Map user → staff → vai trò: `src/dashboard/lib/current-staff.ts`.

---

## 4. Cấu hình bắt buộc (làm 1 lần)

### Bước 4.1 — Biến môi trường

Mở/ tạo file `src/dashboard/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

- 2 dòng `NEXT_PUBLIC_...` đã có sẵn (anon-tier, công khai được).
- `SUPABASE_SERVICE_ROLE_KEY` là dòng **mới cần thêm** để tạo/sửa tài khoản:
  - Lấy ở: **Supabase console → Settings → API → Project API keys → `service_role` (secret)**.
  - ⚠️ Đặt ở **`src/dashboard/.env.local`** (env của dashboard), **KHÔNG** đặt ở
    `.env` gốc (đó là env backend Python).
  - ⚠️ **KHÔNG** thêm prefix `NEXT_PUBLIC_` — để key chỉ chạy phía server, không
    lọt ra trình duyệt.

> Mỗi lần sửa `.env.local` phải **tắt rồi chạy lại `npm run dev`** mới có hiệu lực.
>
> Nếu thiếu key: API `/api/admin/users` trả lỗi **503**, và trang
> `/settings/new-user` hiện cảnh báo vàng.

### Bước 4.2 — Tạo Admin đầu tiên (quan trọng: con-gà-quả-trứng)

Dữ liệu nhân viên seed từ Notion sinh ra **0 dòng `MANAGEMENT`**. Vì chỉ
`MANAGEMENT` mới vào được khu quản lý, nên **admin đầu tiên phải tạo thủ công** qua
console + lệnh CLI. Sau đó MỌI tài khoản khác tạo ngay trong dashboard.

**(a) Tạo dòng staff Quản lý.** Apply seed (idempotent, an toàn chạy lại):

```
src/migrations/seed/008_management_admin.sql
```

→ Apply giống cách bạn đã apply các seed `005/006/007` trong phiên. Nó tạo 1 dòng
staff `Quản trị hệ thống` với `primary_department='MANAGEMENT'`.

> Hoặc, nếu muốn chính bạn là admin (không dùng dòng generic), bỏ qua (a) và nâng
> quyền 1 nhân viên sẵn có:
> ```sql
> UPDATE staff SET primary_department='MANAGEMENT' WHERE full_name='<tên staff>';
> ```

**(b) Tạo Auth user cho admin** trong Supabase console:
- Authentication → Users → **Add user** → nhập email + mật khẩu → tick **Auto-confirm**.
- Copy **UUID** của user vừa tạo.

**(c) Link Auth user với dòng staff** (chạy ở thư mục gốc repo):

```bash
poetry run python scripts/seed/link_staff_to_auth.py --map "Quản trị hệ thống=<uuid>"
```

(nếu bạn nâng quyền staff khác ở (a), thay tên cho khớp)

**(d) Khởi động lại + đăng nhập:**

```bash
cd src/dashboard
npm run dev
```

Mở http://localhost:3000 → đăng nhập bằng email/mật khẩu admin → menu **Cài đặt**
xuất hiện ở sidebar. Từ giờ mọi tài khoản khác tạo trong app, không cần console nữa.

---

## 5. Dùng hằng ngày (Admin)

Tất cả ở trang **Cài đặt** (`/settings`).

### 5.1 Tạo tài khoản cho nhân viên
1. `/settings` → bấm **+ Thêm tài khoản** (hoặc link "Tạo tài khoản" ở dòng NV chưa link).
2. Chọn nhân viên (danh sách chỉ hiện NV **chưa có** tài khoản).
3. Nhập **email đăng nhập** + **mật khẩu tạm** (≥ 8 ký tự) → **Tạo tài khoản**.
4. Gửi email + mật khẩu tạm cho nhân viên qua kênh an toàn. NV nên tự đổi mật khẩu
   ở lần đăng nhập đầu (dùng "Quên mật khẩu?" tại trang login).

### 5.2 Đặt lại mật khẩu
- Ở dòng nhân viên (đã có tài khoản) → nút **Đặt lại mật khẩu** → nhập mật khẩu mới
  (≥ 8 ký tự) → **Lưu**.

### 5.3 Gỡ tài khoản (thu hồi đăng nhập)
- Ở dòng nhân viên → nút **Gỡ tài khoản** → bấm **Xác nhận gỡ**.
- Việc này **xoá hẳn** tài khoản đăng nhập (NV không login được nữa) nhưng **giữ
  nguyên dòng nhân viên** → có thể tạo lại login cho họ sau.

### 5.4 Nhân viên tự đổi/quên mật khẩu
- Trang login → **Quên mật khẩu?** → nhập email → nhận link qua email →
  trang `/reset-password` đặt mật khẩu mới. (Không cần Admin.)

---

## 6. Bên dưới (tham chiếu kỹ thuật)

| Thành phần | File |
|---|---|
| Cổng auth + điều hướng theo vai trò | `src/dashboard/proxy.ts` |
| Map user → staff → vai trò | `src/dashboard/lib/current-staff.ts` |
| Trang Cài đặt (bảng + thao tác) | `src/dashboard/app/(dashboard)/settings/page.tsx` |
| Nút thao tác mỗi dòng (reset/gỡ) | `src/dashboard/app/(dashboard)/settings/AccountActions.tsx` |
| Form tạo tài khoản | `src/dashboard/app/(dashboard)/settings/new-user/` |
| API quản lý tài khoản | `src/dashboard/app/api/admin/users/route.ts` |
| Seed admin MANAGEMENT | `src/migrations/seed/008_management_admin.sql` |
| CLI link staff ↔ Auth user | `scripts/seed/link_staff_to_auth.py` |

**API `/api/admin/users`** (mọi method đều bắt buộc caller là `MANAGEMENT`, dùng
service-role phía server):

| Method | Body | Tác dụng |
|---|---|---|
| `POST` | `{ email, password, staffId }` | Tạo Auth user + link staff |
| `PATCH` | `{ staffId, action: "reset_password", password }` | Đặt lại mật khẩu |
| `PATCH` | `{ staffId, action: "unlink" }` | Xoá Auth user + null FK (giữ staff) |

---

## 7. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Trang `/settings/new-user` báo vàng / API trả **503** | Thiếu `SUPABASE_SERVICE_ROLE_KEY` | Thêm key vào `src/dashboard/.env.local` (mục 4.1) → restart `npm run dev` |
| Đăng nhập xong **không thấy menu Cài đặt** | Tài khoản chưa link với staff `MANAGEMENT` | Làm bootstrap admin (mục 4.2); kiểm tra `primary_department='MANAGEMENT'` của dòng staff đã link |
| API trả **403 Forbidden** | Caller không phải `MANAGEMENT` | Chỉ Admin dùng được các thao tác này |
| API trả **401** | Phiên đăng nhập hết / chưa login | Đăng nhập lại |
| Login xong bị quay lại `/login` liên tục | Sai `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, hoặc cookie | Kiểm tra `.env.local`; xoá cookie; restart |
| Tạo tài khoản báo "đã được link với tài khoản khác" | Nhân viên đó đã có login | Dùng **Đặt lại mật khẩu**, hoặc **Gỡ tài khoản** rồi tạo lại |

---

## 8. Lưu ý bảo mật

- `SUPABASE_SERVICE_ROLE_KEY` có **toàn quyền** — chỉ để ở env server, không commit,
  không gắn prefix `NEXT_PUBLIC_`, không gửi cho ai.
- Mọi thao tác tạo/sửa tài khoản đều kiểm tra lại quyền `MANAGEMENT` ở **server**
  (không tin client).
- Mật khẩu tạm gửi cho nhân viên qua kênh an toàn; khuyến khích NV đổi ngay.
