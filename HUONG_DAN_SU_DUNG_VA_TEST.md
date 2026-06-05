# HƯỚNG DẪN SỬ DỤNG & TEST — Dashboard Dr4Women

> Dành cho **phòng khám test thử**. Đọc Mục 0 trước. Mọi ô `[ ]` là việc cần tick khi test.
> Cập nhật: 2026-06-05.

---

## 0. ĐỌC TRƯỚC — đây là bản TEST

- Đây là **bản chạy thử**, có thể còn lỗi. **Đừng phụ thuộc 100%** vào nó cho ca khám thật quan trọng — nên đối chiếu sổ/giấy trong giai đoạn test.
- Nên test bằng **vài bệnh nhân thử** (hoặc BN thật nhưng người nhập tự kiểm lại). Nếu nhập BN thật: thông tin sẽ lưu lại.
- ⚠️ **Đăng nhập chung (bản test):** ai có **mật khẩu chung** đều **tự chọn được mọi vai trò** (kể cả Bác sĩ / Quản lý) — chưa có mật khẩu riêng từng người. Vì vậy:
  - **Không để lộ mật khẩu chung** ra ngoài phòng khám.
  - Mỗi người **bấm đúng tên mình** khi vào (không mượn tên người khác).
  - Phần này sẽ được siết lại trước khi dùng rộng.
- Khi thấy lỗi → ghi lại theo **mẫu báo lỗi ở Mục 7** rồi gửi cho người phụ trách.

---

## 1. ĐĂNG NHẬP & THOÁT

1. Mở trình duyệt (Chrome/Safari) vào địa chỉ: **`__________________`** *(người phụ trách điền link)*.
2. Nhập **mật khẩu chung** của phòng khám → bấm vào.
3. Màn **"Chọn tên của bạn"** hiện danh sách nhân viên theo chức danh (Bác sĩ, Bác sĩ Siêu âm, Điều dưỡng, Lễ tân, CSKH, Quản lý). Có ô tìm tên.
4. **Bấm đúng tên mình** → vào không gian làm việc theo vai trò của bạn.
5. **Thoát / đổi người:** bấm nút rời phòng khám (góc trên) để quay lại màn chọn tên.

- [ ] Đăng nhập được, thấy đúng lời chào **"Chào [chức danh] [tên]"** trên Trang chủ.
- [ ] Menu bên trái (máy tính) / thanh dưới (điện thoại) hiện đúng các mục của vai trò mình (xem Mục 2).

---

## 2. AI THẤY GÌ — MENU THEO VAI TRÒ

Mỗi vai trò chỉ thấy phần việc của mình. Bảng dưới = các mục **được phép vào**:

| Mục menu | Lễ tân | CSKH | Điều dưỡng | Bác sĩ / BS Siêu âm | Quản lý |
|---|:---:|:---:|:---:|:---:|:---:|
| **Trang chủ** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Nhập thông tin khách hàng mới** *(ĐD: "khách vãng lai")* | ✅ | ✅ | ✅ | — | ✅ |
| **Thông tin khách hàng** | ✅ | ✅ | — | — | ✅ |
| **Danh sách bệnh nhân** | ✅ | ✅ | — | — | ✅ |
| **Công việc của tôi** | — | ✅ | — | ✅ | ✅ |
| **Hàng đợi xét nghiệm** | — | — | ✅ | — | ✅ |
| **Hàng đợi dịch vụ** | — | — | ✅ | — | ✅ |
| **Lịch làm việc (ca trực)** | ✅ | — | ✅ | ✅ | ✅ |
| **Lịch hẹn (check đặt lịch)** | — | — | — | — | ✅ |
| **Bệnh nhân (tra cứu)** | — | — | — | — | ✅ |
| **Báo cáo · Cài đặt** | — | — | — | — | ✅ |
| **Khu Check-in** *(ở Trang chủ)* | ✅ | — | ✅ | — | ✅ |

> 🔒 **Test phân quyền:** nếu gõ thẳng địa chỉ một trang **ngoài quyền** (ví dụ Lễ tân gõ `…/lab-queue`) → hệ thống **tự đẩy về Trang chủ**. (Xem Mục 5.)

---

## 3. LUỒNG CHÍNH — 1 LƯỢT KHÁM TRỌN VẸN (test xương sống)

Đây là kịch bản quan trọng nhất. Làm tuần tự, mỗi vai trò đăng nhập đúng tên của mình.

### Bước 1 — CSKH / Lễ tân: nhập khách + đặt lịch
- Vào **"Nhập thông tin khách hàng mới"**.
- Điền **Họ tên** (bắt buộc), **SĐT**, **Ngày sinh** (hoặc tick *chỉ biết năm*), **cơ sở**.
- (Tuỳ chọn) điền **dịch vụ + ngày + giờ** để **đặt luôn lịch hẹn đầu tiên** trong cùng 1 form.
- Bấm **Lưu** → hệ thống chống trùng (cùng SĐT sẽ cảnh báo) → vào hồ sơ khách.

- [ ] Tạo được khách + lịch trong 1 lần.
- [ ] Nhập **trùng SĐT** → hiện cảnh báo "đã có hồ sơ" (chọn vẫn tạo hoặc dùng hồ sơ cũ).

### Bước 2 — CSKH: xác nhận lịch
- Vào **"Công việc của tôi"** (CSKH thấy bảng **"Tình trạng lịch hẹn"** — 4 cột: Chờ xác nhận → Đã xác nhận → Đã khám xong → Đã huỷ/Từ chối).
- Bấm tên khách → kiểm tra thông tin → **xác nhận lịch** (đã gọi khách).

- [ ] Lịch chuyển từ **Chờ xác nhận** → **Đã xác nhận**.

### Bước 3 — Bác sĩ: nhận ca
- Đăng nhập **tên bác sĩ** → **"Công việc của tôi"** (bảng lịch theo ngày của bác sĩ đó).
- Ở lịch mới: bấm **Nhận** (nhận khám) hoặc **Từ chối**.

- [ ] **Nhận** → trạng thái thành **Đã xác nhận**, hiện *"Chờ lễ tân check-in"*.
- [ ] **Từ chối** → lịch sang **Từ chối**, và **CSKH/Lễ tân thấy thông báo** lịch bị từ chối (góc trên) để phân lại bác sĩ.
- [ ] Bác sĩ **chỉ thấy lịch của chính mình**.

### Bước 4 — Lễ tân / Điều dưỡng: check-in + ghi Sinh hiệu
- Vào **Trang chủ** → khu **Check-in** (chỉ Lễ tân/Điều dưỡng/Quản lý thấy).
- Bấm bệnh nhân đã đến → **Check-in** + nhập **Sinh hiệu** (Mạch, Nhiệt độ, Huyết áp dạng `120/80`, SpO2, Cân nặng…) → **Lưu sinh hiệu**.

- [ ] Check-in xong, trạng thái thành **Đã đến (CHECKED_IN)**.
- [ ] Nhập sai ngưỡng (vd nhiệt độ 377) hoặc huyết áp sai định dạng → hiện **cảnh báo đỏ** ngay ô đó.
- [ ] **Quan trọng:** lễ tân **chỉ check-in được khi bác sĩ ĐÃ nhận ca** (không bỏ qua bước bác sĩ).

### Bước 5 — Bác sĩ: khám & ghi hồ sơ
- **"Công việc của tôi"** → bệnh nhân đã check-in hiện nút **"Mở hồ sơ → khám"**.
- Điền: **II Lý do**, **V Bệnh sử/khám thai**, **VII Chẩn đoán**, **VIII Hướng xử lý & lời dặn**, **IX Đơn thuốc** (mỗi dòng 1 thuốc). Có thể **chỉ định xét nghiệm** ở mục VI.
- Bấm **Lưu**:
  - Nếu **đã điền đủ Chẩn đoán + Lời dặn** → nút là **"Lưu & Khám xong"**, lịch **tự chuyển "Đã khám xong"**.
  - Nếu thiếu → **"Lưu hồ sơ"** (lưu nháp, chưa khám xong).

- [ ] Điền đủ Chẩn đoán + Lời dặn → Lưu → lịch **tự sang "Đã khám xong"**.
- [ ] Lưu nháp (thiếu 1 trong 2) → mở lại **vẫn còn dữ liệu đã nhập** (prefill).
- [ ] **Sinh hiệu điều dưỡng nhập KHÔNG bị mất** sau khi bác sĩ lưu hồ sơ.
- [ ] Bác sĩ **chưa khám được nếu lễ tân chưa check-in** (hiện "🕓 Chờ lễ tân check-in").

### Bước 6 — In phiếu Tóm tắt khám bệnh
- Lịch **Đã khám xong** → bấm **"In phiếu"** → mở trang in khổ A4 → **In / Lưu PDF**.

- [ ] Phiếu hiện **đúng tên/mã BN, đúng bác sĩ, đúng dịch vụ**.
- [ ] **Chẩn đoán, Lời dặn, Sinh hiệu** đúng như đã nhập.
- [ ] Phần **xét nghiệm in ra đúng của lượt khám này** (không lẫn lượt khác).
- [ ] Phiếu **gọn trong 1 trang A4**.

---

## 4. CHECKLIST TEST THEO VAI TRÒ

### A. Lễ tân
- [ ] Trang chủ: thấy 3 ô số (Việc chờ làm / BN mới hôm nay / Lịch chờ xác nhận) + khu Check-in.
- [ ] Nhập khách hàng mới + đặt lịch.
- [ ] Check-in + ghi sinh hiệu (Bước 4).
- [ ] Thông tin khách hàng / Danh sách bệnh nhân: tra cứu, tìm theo **tên không dấu / SĐT / mã**.
- [ ] Sửa thông tin khách (SĐT, địa chỉ…) → lưu được.

### B. CSKH
- [ ] "Công việc của tôi" → xác nhận / đổi lịch / huỷ / phân lại bác sĩ.
- [ ] Thấy **thông báo lịch bị bác sĩ từ chối** để xử lý lại.
- [ ] Lọc theo **kỳ** (Hôm nay/Tuần này/Tuần sau/Tháng) + theo **trạng thái**.

### C. Điều dưỡng
- [ ] Check-in + ghi sinh hiệu (Trang chủ).
- [ ] **Hàng đợi xét nghiệm:** nhập kết quả / đính link phiếu (PDF/Drive) cho XN bác sĩ chỉ định.
- [ ] **Hàng đợi dịch vụ / thủ thuật:** cập nhật đang làm / hoàn tất.
- [ ] Nhập **khách vãng lai** (menu hiện "khách vãng lai").

### D. Bác sĩ / BS Siêu âm
- [ ] Nhận / Từ chối ca.
- [ ] Khám + ghi hồ sơ + kê đơn + chỉ định XN (Bước 5).
- [ ] Xem **lịch sử khám trước** của BN trong hồ sơ.
- [ ] Lọc lịch theo **Tuần này / Tháng này** → **thấy đủ cả lịch đầu kỳ** (vd vào Thứ Năm vẫn thấy lịch Thứ 2–4).
- [ ] In phiếu.

### E. Quản lý
- [ ] Vào được **tất cả** các trang.
- [ ] **Lịch hẹn (check đặt lịch)**, **Bệnh nhân (tra cứu)**, **Báo cáo**, **Cài đặt**.
- [ ] **Lịch làm việc (ca trực):** xếp/sửa ca cho nhân viên.

---

## 5. CÁC ĐIỂM CẦN TEST KỸ (dễ sai)

**Quy tắc nhập liệu (báo lỗi ngay cạnh ô):**
- [ ] SĐT phải **đúng 10 số**; SĐT người nhà cũng vậy → nhập sai báo lỗi.
- [ ] CCCD phải **đúng 12 số**; **trùng CCCD** → báo "đã có hồ sơ".
- [ ] Ngày sinh: nhập **ngày đầy đủ** hoặc tick **"chỉ biết năm"** → đều hợp lệ; năm vô lý (tương lai) → báo lỗi.

**Phân quyền (quan trọng):**
- [ ] Đăng nhập 1 vai trò, **gõ thẳng URL** một trang ngoài quyền → **tự đẩy về Trang chủ** (không xem được dữ liệu).

**Gate an toàn lâm sàng:**
- [ ] Bác sĩ **không khám được khi chưa check-in**.
- [ ] Hồ sơ **đã chốt** (khoá) → **chỉ xem, không sửa** (báo "luật cấm sửa, phải đính chính").
- [ ] Bấm **Nhận/Từ chối 2 lần nhanh** → không bị lỗi đỏ khó hiểu.

**Phiếu in & ngày giờ:**
- [ ] Lịch **chỉ có ngày** (không có giờ) → phiếu/hiển thị ghi **ngày**, **không hiện "00:00"**.
- [ ] Giờ hiển thị theo **giờ Việt Nam**.

---

## 6. HẠN CHẾ ĐÃ BIẾT (ĐỪNG báo nhầm là lỗi)

- **Đăng nhập chung + tự chọn tên** (chưa có mật khẩu riêng từng người) — bản test, sẽ siết sau.
- **"Nhật ký chăm sóc khách hàng (CSKH)"** ở cuối trang "Công việc của tôi" đang ghi **🚧 Đang xây dựng** — chưa nối Zalo/Pancake (sẽ tự ghi sau).
- **Chưa có nhập liệu bằng giọng nói** (voice).
- **Ngày sinh "chỉ biết năm"**: ở một vài chỗ có thể hiển thị/in **chưa thật chuẩn** — đang xử lý (tuỳ phiên bản cơ sở dữ liệu).
- **Báo cáo / Cài đặt / Lịch hẹn (check đặt lịch) / Tra cứu BN**: chỉ **Quản lý** thấy.
- Một số dịch vụ (loại khám) có thể **chưa gắn đúng tên** với dữ liệu cũ — đang chuẩn hoá ở giai đoạn nhập liệu.

---

## 7. MẪU BÁO LỖI (gửi cho người phụ trách)

Copy mẫu này, điền vào mỗi khi gặp lỗi — càng rõ càng dễ sửa:

```
- Vai trò đang đăng nhập:  (vd: Lễ tân — tên Hà)
- Trang / mục:             (vd: Trang chủ → Check-in)
- Các bước đã làm:         (1… 2… 3…)
- Mong đợi:                (vd: lưu sinh hiệu thành công)
- Thực tế xảy ra:          (vd: báo lỗi đỏ "…", hoặc bị xoay vòng)
- Thời điểm:               (ngày giờ)
- Thiết bị / trình duyệt:  (vd: iPhone Safari / laptop Chrome)
- Ảnh chụp màn hình:       (đính kèm)
```

> Mẹo: lỗi liên quan **mạng** thường tự hết khi **tải lại trang** (F5). Nếu vẫn lỗi sau khi tải lại → báo theo mẫu trên.

---

*Tài liệu này mô tả đúng phiên bản dashboard hiện tại trên nhánh test. Khi có tính năng mới sẽ cập nhật lại.*
