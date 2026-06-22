#!/bin/bash
# Giữ backend ClinicAI sống trên Mac mini M4 — idempotent + tự chữa.
# Bảo đảm:  (1) container `api` đang chạy (docker compose),
#           (2) Tailscale Funnel đang phơi localhost:8000 ra HTTPS công khai.
# Được LaunchAgent gọi lúc đăng nhập + mỗi 5 phút (self-heal). Chạy tay cũng an toàn.
#
# Tham số $1 = đường dẫn repo (LaunchAgent truyền vào). Mặc định = giả định dưới.
set -u

REPO="${1:-$HOME/Projects/AI Clinic Dr4Women/Clinic-AI-Dr4Women}"
PORT=8000
LOG="$HOME/Library/Logs/clinic-backend-boot.log"

ts()  { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

# launchd cho PATH tối thiểu → nạp các vị trí thường gặp của docker/tailscale.
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

# 1) Đưa container API lên (no-op nếu đang chạy; restart:unless-stopped lo phần crash).
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if docker compose -f "$REPO/docker-compose.yml" up -d api >>"$LOG" 2>&1; then
      log "docker compose up -d api OK"
    else
      log "docker compose up -d api FAILED"
    fi
  else
    log "docker daemon chưa sẵn sàng — bỏ qua, thử lại lần sau"
  fi
else
  log "không thấy docker trên PATH"
fi

# 2) Bảo đảm Tailscale Funnel đang phơi cổng (config có persist, nhưng re-assert để tự chữa).
if command -v tailscale >/dev/null 2>&1; then
  if ! tailscale funnel status 2>/dev/null | grep -q ":$PORT"; then
    if tailscale funnel --bg "$PORT" >>"$LOG" 2>&1; then
      log "tailscale funnel --bg $PORT đã bật"
    else
      log "bật funnel THẤT BẠI (chạy 1 lần: sudo tailscale set --operator=\$USER)"
    fi
  fi
else
  log "không thấy tailscale trên PATH"
fi
