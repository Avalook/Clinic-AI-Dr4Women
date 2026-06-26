# Hiểu ý làm việc — ClinicAI / Dr4women

> File này để 2 anh em (Quang + Claude) thống nhất *cùng một bản đồ*: hệ thống gồm trang nào, vai trò nào, ai thấy gì, và quy trình làm việc / deploy ra sao. Đọc cái này là nắm tổng thể trong 5 phút.
>
> **Cập nhật lần đầu:** 2026-06-26. Khi đổi route / vai trò / quyền → sửa file này luôn.
> **Nguồn sự thật (đừng tin doc, tin code):** `src/dashboard/lib/roles.ts` (vai trò + quyền) và `src/dashboard/app/(dashboard)/nav-items.ts` (danh sách trang).

---

## 0. Quy ước làm việc (đọc trước)

- **Chỉ làm trên nhánh `chinh`.** Đây là nhánh duy nhất. Không tạo nhánh khác trừ khi Quang yêu cầu.
- **Quy trình mỗi việc:** Quang giao việc → Claude khảo sát read-only → code + test → commit local → báo cáo 3-5 dòng. **Không tự push.**
- **Push = lên web luôn** (autoDeploy). Chỉ `git push avalook chinh` **khi Quang xem và nói "OK"**.
- **Không tự quyết:** safety gate lâm sàng, deploy production, sửa file ngoài scope.
- Khi không chắc → **STOP, hỏi**. Đừng đoán.

---

## 1. Kiến trúc 3 tầng (hiện trạng)

| Tầng | Là gì | Ở đâu | Ghi chú |
|---|---|---|---|
| **Frontend (Dashboard)** | Next.js, `src/dashboard/` | Vercel → https://dr4women.vercel.app | Phòng khám đang dùng cái này |
| **Backend (API)** | FastAPI, `src/clinicai/` | Vercel | Tạo BN qua đây (MPI chống trùng); đọc dữ liệu qua Supabase |
| **Database** | PostgreSQL | **Supabase** | 2 project: `atf…` = **prod** (web dùng), `fzw…` = **dev** (.env trỏ vào) |

⚠️ **2 remote Git:**
- `avalook` (github.com/Avalook/…) = repo THẬT, nối Vercel → **luôn push cái này**.
- `origin` (fork cá nhân) = KHÔNG lên web.

⚠️ **DB prod chỉ Quang apply tay.** Mọi đổi DB → Claude đưa SQL, Quang paste vào project `atf` (prod). KHÔNG tự apply prod. Thêm/bỏ cột → SQL phải `NOTIFY pgrst, 'reload schema'` nếu không màn hình trống.

---

## 2. Các trang trong Dashboard

Đường dẫn lấy từ `nav-items.ts`. Cột "Ai thấy" lấy từ `NAV_ROLES` trong `roles.ts` (`all` = mọi vai).

| Route | Tên hiển thị | Mục đích | Ai thấy (nav) |
|---|---|---|---|
| `/login` | Đăng nhập | 1 tài khoản Supabase chung gate app | Mọi người |
| `/role-picker` | Chọn vai | Sau login chọn vai → lưu cookie | Mọi người |
| `/home` | Trang chủ | Tổng quan + **Check-in** (đón khách đã đến) | `all` |
| `/cskh-today` | Cần làm hôm nay | Việc CSKH tự sinh (gọi xác nhận, phân lại lịch, tái khám, KQ XN về) | CSKH, Quản lý, Trưởng ca |
| `/appointments` | Lịch hẹn | Quản lý vòng đời lịch hẹn | Quản lý, Trưởng ca |
| `/customers` | Thông tin khách hàng | Danh bạ + tra cứu tên/mã/SĐT | CSKH, Lễ tân, Quản lý, Thu ngân (xem), Trưởng ca |
| `/patient-list` | Danh sách bệnh nhân | BN **đã khám**; click tên → popup PHIẾU KHÁM (mọi vai đồng bộ) | Front desk + Bác sĩ + ĐD + TKYK |
| `/patients/[id]` | Hồ sơ bệnh nhân (chi tiết) | Đích nút "Tái khám"; không có trên nav | Bác sĩ (BN của mình) + ops |
| `/patients/new` | Tạo bệnh nhân | Nhập BN mới (intake) | CSKH, Lễ tân, Quản lý, Trưởng ca |
| `/tasks` | Công việc của tôi | Board khám của bác sĩ (TKYK nhập hộ; Lễ tân/Thu ngân chỉ xem) | Bác sĩ + TKYK + ĐD + front desk + thu ngân |
| `/truong-ca` | Theo dõi buổi | Trưởng ca theo dõi buổi (read-only lâm sàng) | Trưởng ca, Quản lý |
| `/lab-queue` | Hàng đợi xét nghiệm | ĐD/KTV thực hiện XN | ĐD, Quản lý |
| `/service-queue` | Hàng đợi dịch vụ | ĐD/KTV thực hiện dịch vụ | ĐD, Quản lý |
| `/sono` | ĐD siêu âm | Hàng đợi BN sắp SA + XN 3 trạng thái + in phiếu | ĐD, Quản lý |
| `/cashier/thuoc` | Bảng giá thuốc | Thu ngân thuốc | Thu ngân thuốc, Thu ngân (superset), Quản lý, Trưởng ca |
| `/cashier/dich-vu` | Bảng giá dịch vụ | Thu ngân dịch vụ | Thu ngân DV, Thu ngân (superset), Quản lý, Trưởng ca |
| `/schedule` | Lịch làm việc | Mọi vai tự đăng ký ca; QL/Trưởng ca xếp cả bảng | `all` |
| `/work-sessions` | Buổi làm việc | Quản lý buổi | Quản lý, Trưởng ca |
| `/reports` | Báo cáo | Thống kê | Quản lý, Trưởng ca |
| `/settings` | Cài đặt | Tạo user / cấu hình hệ thống | **Chỉ Quản lý** |

---

## 3. Các vai trò (11 vai)

Từ `ALL_ROLES` + `ROLE_LABEL` trong `roles.ts`.

| Mã | Tên | Nhóm | Làm gì chính |
|---|---|---|---|
| `DOCTOR` | Bác sĩ | Lâm sàng | Khám, ghi bệnh án, chỉ định XN — board `/tasks` |
| `ULTRASOUND_DOCTOR` | Bác sĩ Siêu âm | Lâm sàng | Nhập số đo SA thai (CRL/NT/BPD/HC/AC/FL/EFW) |
| `NURSE_ULTRASOUND` | Điều dưỡng / Phụ siêu âm | Lâm sàng | Lo **3 hàng đợi** (XN, dịch vụ, SA); ghi lâm sàng theo buổi. **Không** tạo BN, **không** check-in |
| `TKYK` | Thư ký Y khoa | Lâm sàng | Nhập **hộ** bệnh án cho bác sĩ (mọi bác sĩ) |
| `CSKH` | CSKH | Front desk | Ghi khách + lịch hẹn, "Cần làm hôm nay" |
| `RECEPTION` | Lễ tân | Front desk | Đón khách, check-in, intake; xem `/tasks` **chỉ đọc** |
| `MANAGEMENT` | Quản lý | Quản trị | Toàn quyền + duy nhất vào `/settings` |
| `TRUONG_CA` | Trưởng ca | Quản trị vận hành | Như Quản lý cho màn **vận hành**; lâm sàng chỉ xem; **không** vào `/settings` |
| `CASHIER` | Thu ngân | Thu ngân | Superset — thấy cả bảng giá thuốc + DV |
| `CASHIER_THUOC` | Thu ngân thuốc | Thu ngân | Chỉ bảng giá thuốc |
| `CASHIER_DV` | Thu ngân dịch vụ | Thu ngân | Chỉ bảng giá dịch vụ |

### Ranh giới quyền quan trọng (các hàm gate trong `roles.ts`)
- **`canWriteClinical`** (ghi lâm sàng) = Bác sĩ + ĐD + TKYK. Lễ tân/Quản lý KHÔNG ghi lâm sàng.
- **`canWriteIntake`** (tạo BN/lịch) = CSKH + Lễ tân + Quản lý + Trưởng ca. **ĐD đã bỏ** (23/6).
- **`canCheckin`** (đón khách đến) = Lễ tân + Quản lý.
- **`canManageAppt`** (hủy/phân lại lịch) = CSKH + Quản lý + Trưởng ca.
- **`canEditPatient`** (sửa hành chính BN) = nhóm intake + Bác sĩ (không đụng CCCD/định danh).
- **`isOpsAdmin`** (quản trị vận hành) = Quản lý + Trưởng ca; nhưng `/settings` chỉ Quản lý.
- **Trang đích sau khi chọn vai** (`roleLanding`): Bác sĩ → `/tasks`, Trưởng ca → `/truong-ca`, còn lại → `/home`.

---

## 4. CI/CD & DevOps — định hướng (AI tích hợp sau)

Hiện trạng: deploy đang "order gì làm đó" — push tay khi OK, DB apply tay. Hướng chuẩn hoá sẽ chốt riêng. Khung sơ bộ:

1. **Nhánh:** giữ `chinh` là dòng chính. Cân nhắc thêm gate CI (lint + mypy + pytest) chạy **trước** khi merge/deploy.
2. **Frontend/Backend (Vercel):** giữ autoDeploy từ `avalook chinh`, nhưng thêm **preview deploy** để xem trước trước khi lên prod.
3. **DB (Supabase):** chuẩn hoá luồng migration `dev (fzw) → prod (atf)` — viết migration versioned, test trên dev, rồi mới apply prod (vẫn Quang gác cổng).
4. **Bí mật/ENV:** soát lại biến môi trường giữa local `.env` (fzw) và Vercel (atf) cho khớp ý đồ.

> Phần CI/CD chi tiết sẽ làm thành task riêng. File này chỉ chốt *bản đồ chung* để 2 anh em hiểu ý nhau.
