# Deploy FastAPI trên Mac mini M4 (+ Tailscale Funnel)

Backend `src/clinicai` chạy 24/7 trên Mac mini, phơi ra internet qua **Tailscale
Funnel** (không cần mua domain) để dashboard trên Vercel gọi tới được.

Đây là **host giai đoạn này**. Khi cần bền hơn (mất điện/mạng nhà), dời sang VPS —
phía dashboard chỉ đổi 1 biến `CLINIC_API_URL`, không sửa code. (Đúng lộ trình
sơ đồ: Mac mini → Railway/VPS.)

> Quy ước nhánh (CLAUDE.md §3): làm trên `chinh`, chỉ merge sang
> `feat/t-transform-01` (nhánh production nối Vercel) khi đã CHỐT + có lệnh.

---

## Kiến trúc luồng

```
Trình duyệt → Vercel (Next.js /api/brief) → [Tailscale Funnel HTTPS] → Mac mini FastAPI :8000 → Supabase
```

- Vercel gọi FastAPI **từ phía server** (server→server) → không dính CORS, giữ
  `BACKEND_API_KEY` ở server, không lộ ra bundle trình duyệt.
- Hiện CHỈ route `app/api/brief/[id]` đi qua FastAPI. Các route khác đọc/ghi
  thẳng Supabase (xem phân loại trong worklog).

---

## Yêu cầu trước khi bắt đầu

- Mac mini M4 (đã có), bật 24/7.
- Docker Desktop for Mac (đặt **mở khi đăng nhập**).
- Tài khoản Tailscale (miễn phí).
- `.env` ở gốc repo điền đủ (xem §B).

---

## §A. Chống Mac ngủ (BẮT BUỘC — Mac ngủ = API chết = brief 502)

System Settings → **Energy / Battery**:
- Bật **"Prevent automatic sleeping when the display is off"**.
- Đặt "Turn display off" tùy ý, nhưng **không để máy sleep**.

---

## §B. Chạy API bằng Docker

`docker-compose.yml` đã định sẵn service `api` (`restart: unless-stopped`,
`env_file: .env`, cổng 8000, healthcheck) — không cần sửa.

1. Điền `.env` ở gốc repo (4 biến tối thiểu cho luồng brief):

   | Biến | Ghi chú |
   |---|---|
   | `DATABASE_URL` | Supabase Postgres (asyncpg). Mac phải kết nối ra được (5432 hoặc pooler 6543). |
   | `ANTHROPIC_API_KEY` | LLM cho brief. |
   | `BACKEND_API_KEY` | Chuỗi ngẫu nhiên dài. **Phải khớp** biến cùng tên trên Vercel. |
   | `DEFAULT_LOCATION_ID` | (tùy chọn) cho scheduling service. |

   > RabbitMQ KHÔNG cần để chạy brief/patients — `lifespan` không kết nối broker lúc boot.

2. Bật:
   ```bash
   docker compose up -d api
   curl -f http://localhost:8000/health      # kỳ vọng: 200
   ```

---

## §C. Phơi ra internet bằng Tailscale Funnel

```bash
brew install tailscale
sudo tailscale up

# Cho phép user chạy lệnh tailscale không cần sudo (để LaunchAgent quản được funnel):
sudo tailscale set --operator=$(whoami)
```

Trong **admin console** Tailscale (https://login.tailscale.com/admin):
- Bật **MagicDNS** + **HTTPS certificates**.
- Bật **Funnel** cho máy này (ACL `nodeAttrs` → attribute `funnel`).

Phơi cổng 8000:
```bash
tailscale funnel --bg 8000
tailscale funnel status        # in ra URL công khai
```
→ Được URL HTTPS cố định: `https://<tên-máy>.<tailnet>.ts.net`

> Config funnel persist trong tailscaled → sống lại sau reboot. LaunchAgent ở §E
> re-assert thêm cho chắc.

---

## §D. Nối dashboard (Vercel)

Set env cho project Vercel (môi trường **Production** = nhánh `feat/t-transform-01`):

| Biến | Giá trị |
|---|---|
| `CLINIC_API_URL` | `https://<tên-máy>.<tailnet>.ts.net` — **KHÔNG** kèm `/api/v1`, **KHÔNG** dấu `/` cuối. |
| `BACKEND_API_KEY` | Khớp **y hệt** `.env` trên Mac mini. |

Route tự ghép `${CLINIC_API_URL}/api/v1/brief/{id}`. Sau khi set → **Redeploy** dashboard.

---

## §E. Tự khởi động khi Mac boot (LaunchAgent)

`scripts/clinic-backend-boot.sh` (idempotent, tự chữa): đưa container `api` lên +
bảo đảm funnel đang phơi cổng. LaunchAgent chạy nó lúc đăng nhập + mỗi 5 phút.

Cài (thay placeholder bằng đường dẫn thật rồi nạp):
```bash
chmod +x "scripts/clinic-backend-boot.sh"

REPO="$(pwd)"
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|__REPO__|$REPO|g" -e "s|__HOME__|$HOME|g" \
  docker/com.dr4women.clinic-backend.plist \
  > "$HOME/Library/LaunchAgents/com.dr4women.clinic-backend.plist"

launchctl unload "$HOME/Library/LaunchAgents/com.dr4women.clinic-backend.plist" 2>/dev/null
launchctl load   "$HOME/Library/LaunchAgents/com.dr4women.clinic-backend.plist"
```

Kiểm tra:
```bash
launchctl list | grep clinic-backend          # thấy label = đang nạp
tail -f "$HOME/Library/Logs/clinic-backend-boot.log"
```

Gỡ:
```bash
launchctl unload "$HOME/Library/LaunchAgents/com.dr4women.clinic-backend.plist"
rm "$HOME/Library/LaunchAgents/com.dr4women.clinic-backend.plist"
```

---

## §F. Verify end-to-end

1. Đăng nhập dashboard với vai **bác sĩ**.
2. Mở 1 BN **thuộc lịch khám của mình** → bấm **"Tóm tắt trước khám"**.
3. Kỳ vọng: ra markdown thật, không còn lỗi 502.

Khắc phục nếu 502:
- `tailscale funnel status` còn sống không? URL có khớp `CLINIC_API_URL` không?
- `BACKEND_API_KEY` hai bên (Mac `.env` ↔ Vercel) có khớp không?
- `curl -f http://localhost:8000/health` trên Mac còn 200 không?
- `docker compose logs api` xem boot có lỗi `DATABASE_URL` / `ANTHROPIC_API_KEY` không.

---

## Rủi ro đã biết

- **Mất điện/mạng nhà → API chết.** Dashboard vẫn đọc Supabase bình thường; chỉ
  brief lỗi tạm. Cần bền hơn → dời VPS.
- **Bảo mật:** mọi route bị `BACKEND_API_KEY` chặn; funnel không mở cổng router.
  Có thể thêm Tailscale ACL/Access sau. Không đặt service-role key lên FastAPI nếu
  không thật cần.
- **pre-commit hook đang gãy** (`python@3.14` mất) → commit phải `--no-verify`
  hoặc sửa môi trường pre-commit (việc dọn riêng).
