#!/bin/bash
# Giữ backend ClinicAI sống trên Mac mini M4 — idempotent + tự chữa (headless Colima).
# Bảo đảm:  (1) Colima (Docker runtime) đang chạy,
#           (2) container `api` đang chạy (docker-compose.prod.yml),
#           (3) Tailscale Funnel đang phơi localhost:8000 ra HTTPS công khai
#               (bỏ qua nếu dùng Cloudflare Tunnel qua profile `cloudflare`).
# Được LaunchDaemon gọi lúc BOOT (không cần đăng nhập GUI) + mỗi 5 phút (self-heal).
# Chạy tay cũng an toàn.
#
# $1 = đường dẫn CLONE SERVER (LaunchDaemon truyền vào). Mặc định = clone server chuẩn.
set -u

REPO="${1:-$HOME/clinic-server/Clinic-AI-Dr4Women}"
PORT=8000
COMPOSE_FILE="$REPO/docker-compose.prod.yml"
LOG="$HOME/Library/Logs/clinic-backend-boot.log"

ts()  { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

# launchd cho PATH tối thiểu → nạp vị trí thường gặp của brew/colima/docker/tailscale.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 0) Colima (Docker runtime headless) — start nếu chưa chạy.
if command -v colima >/dev/null 2>&1; then
  if ! colima status >/dev/null 2>&1; then
    if colima start >>"$LOG" 2>&1; then log "colima start OK"; else log "colima start FAILED"; fi
  fi
else
  log "không thấy colima trên PATH (cài: brew install colima docker)"
fi

# 1) Đưa container API lên (no-op nếu đang chạy; restart:unless-stopped lo phần crash).
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker compose -f "$COMPOSE_FILE" up -d api >>"$LOG" 2>&1; then
    log "docker compose (prod) up -d api OK"
  else
    log "docker compose (prod) up -d api FAILED — kiểm tra $COMPOSE_FILE + .env"
  fi
else
  log "docker daemon chưa sẵn sàng — bỏ qua, thử lại lần sau"
fi

# 2) Tailscale Funnel phơi cổng (bỏ qua nếu đã chuyển sang Cloudflare Tunnel).
if command -v tailscale >/dev/null 2>&1; then
  if ! tailscale funnel status 2>/dev/null | grep -q ":$PORT"; then
    if tailscale funnel --bg "$PORT" >>"$LOG" 2>&1; then
      log "tailscale funnel --bg $PORT đã bật"
    else
      log "bật funnel THẤT BẠI (chạy 1 lần: sudo tailscale set --operator=\$USER)"
    fi
  fi
else
  log "không thấy tailscale (ok nếu dùng Cloudflare Tunnel qua profile cloudflare)"
fi
