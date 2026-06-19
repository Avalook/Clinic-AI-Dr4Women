#!/usr/bin/env bash
# Bootstrap 1 Supabase MỚI tới ĐÚNG tiến độ schema của nhánh hiện tại.
# Mục đích: dựng môi trường thứ 2 (test/prod) — Supabase mới khớp y schema + seed
# cấu trúc của nhánh này, KHÔNG nạp data bệnh nhân.
#
# Dùng:
#   TARGET_DB_URL="postgresql://...connection string của Supabase MỚI..." \
#     bash scripts/bootstrap_new_db.sh
#
# Làm 3 bước:
#   1) Forward migrations (src/migrations/*.sql, 001→056) — tạo bảng/RLS/constraint.
#   2) Seed cấu trúc (src/migrations/seed/*.sql) — clinic_location, service_type,
#      STAFF (BẮT BUỘC: không có staff thì role-picker rỗng → KHÔNG đăng nhập nổi),
#      booking_channel, province/ward, các vai (TKYK/Trưởng ca/Thu ngân/Lễ tân/ĐD).
#   3) Realtime publication (payment + visit) — cho thanh tiến trình cập nhật live.
set -euo pipefail

DB="${TARGET_DB_URL:-${1:-}}"
if [[ -z "$DB" ]]; then
  echo "Thiếu connection string Supabase mới."
  echo "Dùng: TARGET_DB_URL=postgresql://... bash scripts/bootstrap_new_db.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1/3 Forward migrations (tạo schema) vào Supabase mới"
# apply_migrations.py đọc DATABASE_URL (load_dotenv KHÔNG override biến đã export).
# Cần clinicai trên path → poetry run; nếu không có poetry: PYTHONPATH=src python ...
DATABASE_URL="$DB" poetry run python scripts/apply_migrations.py

echo "==> 2/3 Seed cấu trúc (location / service_type / STAFF / province-ward / roles)"
for f in $(ls src/migrations/seed/*.sql | sort); do
  echo "   - $f"
  psql "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> 3/3 Realtime publication (payment + visit)"
psql "$DB" -v ON_ERROR_STOP=1 \
  -c "ALTER PUBLICATION supabase_realtime ADD TABLE payment, visit;" \
  || echo "   (bỏ qua nếu bảng đã trong publication)"

echo ""
echo "==> XONG. Supabase mới đã khớp schema + seed của nhánh hiện tại."
echo "    Còn lại: set env var (URL/anon/service_role của Supabase mới) cho nhánh"
echo "    mới trên Vercel — KHÔNG sửa code."
