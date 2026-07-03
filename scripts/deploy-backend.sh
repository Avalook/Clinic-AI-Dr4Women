#!/bin/bash
# Deploy backend ClinicAI trên Mac mini — CHẠY TRONG CLONE SERVER (~/clinic-server/...).
# Thủ công có kiểm soát: pull → build → migrate → reload PostgREST → up → healthcheck.
# Backend KHÔNG auto-deploy theo mỗi commit dashboard → commit `chinh` cho Vercel
# KHÔNG ảnh hưởng backend đang chạy tới khi bạn chủ động chạy script này.
#
# Dùng: cd ~/clinic-server/Clinic-AI-Dr4Women && ./scripts/deploy-backend.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Repo: $REPO"

# An toàn: chặn chạy nhầm trong folder dev (chỉ chạy ở clone server).
case "$REPO" in
  *clinic-server*) : ;;
  *) echo "!! Script này chỉ chạy trong CLONE SERVER (đường dẫn phải chứa 'clinic-server')."; \
     echo "   Đang ở: $REPO — hủy để tránh đụng folder dev."; exit 1 ;;
esac

if [ ! -f .env ]; then
  echo "!! Thiếu .env trong clone server. Copy từ .env.example rồi điền (cùng DATABASE_URL với dev)."; exit 1
fi

echo "==> 1/6 Kéo code mới (chinh)"
git pull --ff-only

echo "==> 2/6 Build image api + dashboard"
$COMPOSE build api dashboard

echo "==> 3/6 Chạy migrations (idempotent, DATABASE_URL trong .env)"
set -a; . ./.env; set +a
PYTHONPATH=src python3 scripts/apply_migrations.py

echo "==> 4/6 NOTIFY PostgREST reload schema (tránh cache cột cũ)"
if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  # DATABASE_URL của app dùng +asyncpg — psql cần scheme thuần postgresql://
  PSQL_URL="${DATABASE_URL/+asyncpg/}"
  psql "$PSQL_URL" -c "NOTIFY pgrst, 'reload schema';" || echo "   (bỏ qua NOTIFY: psql lỗi/không cần)"
else
  echo "   (bỏ qua NOTIFY: thiếu psql hoặc DATABASE_URL — Supabase cloud thường tự reload)"
fi

echo "==> 5/6 Khởi động lại api + dashboard"
$COMPOSE up -d

echo "==> 6/6 Healthcheck (api :8000 + dashboard :3000)"
api_ok=""; web_ok=""
for i in $(seq 1 30); do
  [ -z "$api_ok" ] && curl -fsS http://localhost:8000/health >/dev/null 2>&1 && api_ok=1
  [ -z "$web_ok" ] && curl -fsS http://localhost:3000/ >/dev/null 2>&1 && web_ok=1
  if [ -n "$api_ok" ] && [ -n "$web_ok" ]; then
    echo "OK — api + dashboard healthy. Deploy xong."
    exit 0
  fi
  sleep 3
done
echo "!! Chưa healthy sau ~90s (api=${api_ok:-no} web=${web_ok:-no}). Log: $COMPOSE logs --tail=80"
exit 1
