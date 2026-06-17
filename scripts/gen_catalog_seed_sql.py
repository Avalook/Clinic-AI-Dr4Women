#!/usr/bin/env python3
"""Sinh migration 051 (DDL + SEED) từ scripts/catalog_out/{services,drugs}.csv.

Tách generator khỏi parser để SQL deterministic, review được, KHÔNG gõ tay 93 row.
Idempotent: drug_catalog ON CONFLICT(name_raw) DO NOTHING; service_price
ON CONFLICT("group", service_code) DO NOTHING. Giá để NULL (lazy-fill).
"""
from __future__ import annotations

import csv
import re
import unicodedata

OUT_DIR = "scripts/catalog_out"
MIG = "src/migrations/20260617_051_create_drug_catalog_and_cls_seed.sql"
MIG_DOWN = "src/migrations/20260617_051_create_drug_catalog_and_cls_seed.down.sql"


def unaccent(s: str) -> str:
    s = s.replace("Đ", "D").replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def slug(s: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", unaccent(s).upper()).strip("_")


def q(s: str) -> str:
    """Escape literal SQL ''."""
    return s.replace("'", "''")


def load(name: str) -> list[dict]:
    with open(f"{OUT_DIR}/{name}", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    services = load("services.csv")
    drugs = load("drugs.csv")

    # service_code duy nhất trong group dich_vu
    used: set[str] = set()
    svc_rows: list[str] = []
    for s in services:
        code = "CLS_" + slug(s["name"])
        base = code
        i = 2
        while code in used:
            code = f"{base}_{i}"
            i += 1
        used.add(code)
        tang = s["tang"]
        tang_sql = f"'{q(tang)}'" if tang else "NULL"
        svc_rows.append(
            f"  ('{code}', '{q(s['name'])}', 'dich_vu', "
            f"'{q(s['group'])}', {tang_sql})"
        )

    drug_rows: list[str] = []
    for d in drugs:
        variant = d["variant"]
        variant_sql = f"'{q(variant)}'" if variant else "NULL"
        needs = "TRUE" if d["needs_review"] == "TRUE" else "FALSE"
        drug_rows.append(
            f"  ('{q(d['name_base'])}', '{q(d['name_raw'])}', {variant_sql}, "
            f"'{q(d['group_line'])}', {needs})"
        )

    up = f"""-- 051 — Danh mục THUỐC (drug_catalog mới) + CHỈ ĐỊNH CLS (seed vào service_price).
-- Nguồn: PHIẾU CHỈ ĐỊNH (PK gửi) → scripts/parse_chidinh_catalog.py.
-- BOUNDARY: giá NULL (lazy-fill ở màn Thu ngân); thuốc giữ name_raw VERBATIM,
-- variant best-effort, needs_review=TRUE cho dòng không chắc; dịch vụ chỉ THÊM
-- NEW (ON CONFLICT DO NOTHING) — KHÔNG đụng rows/giá đã có.
-- Apply LẺ out-of-band (psql trực tiếp + apply_migrations.py --mark-applied),
-- KHÔNG sequential-to-max, KHÔNG chạm lỗ 043.

BEGIN;

-- (1) Master danh mục thuốc — picker "Đơn thuốc" đọc từ đây (name_raw + variant).
CREATE TABLE IF NOT EXISTS drug_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_base   TEXT NOT NULL,
    name_raw    TEXT NOT NULL UNIQUE,          -- VERBATIM từ phiếu PK; key idempotent
    variant     TEXT,                          -- best-effort (2v/4v, (Đ)/(U), 10v/15v...)
    group_label TEXT,                          -- dòng-nhóm trong phiếu (L1..L9)
    unit_price  NUMERIC(12, 0),                -- VND; NULL = chưa nhập giá (lazy-fill)
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,-- TRUE = dược cần xác nhận biến thể/định danh
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drug_catalog_active ON drug_catalog (name_base) WHERE is_active;

COMMENT ON TABLE drug_catalog IS 'Danh mục thuốc (menu BS kê đơn). Nguồn: PHIẾU CHỈ ĐỊNH PK. Giá lazy-fill.';
COMMENT ON COLUMN drug_catalog.name_raw IS 'Tên thuốc VERBATIM từ phiếu (gồm cả biến thể trong ngoặc).';
COMMENT ON COLUMN drug_catalog.needs_review IS 'TRUE: định danh/biến thể chưa chắc, dược xác nhận trước khi dùng thật.';

ALTER TABLE drug_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drug_catalog_select_authenticated ON drug_catalog;
CREATE POLICY drug_catalog_select_authenticated
  ON drug_catalog FOR SELECT TO authenticated USING (true);

-- (2) service_price: thêm cột phân loại CLS để picker "Chỉ định CLS" group theo nhóm.
--     Cột nullable → rows cũ KHÔNG bị đụng (đúng boundary).
ALTER TABLE service_price ADD COLUMN IF NOT EXISTS category TEXT;  -- nhóm CLS (Thai/Nội tiết.../Thủ thuật/Chụp phim/Tầng 1)
ALTER TABLE service_price ADD COLUMN IF NOT EXISTS tang TEXT;      -- tầng (best-effort, có thể NULL)
COMMENT ON COLUMN service_price.category IS 'Nhóm CLS để picker Chỉ định CLS gom nhóm (NULL cho dòng nhập tay ở Thu ngân).';

-- (3) Seed THUỐC → drug_catalog (giá NULL).
INSERT INTO drug_catalog (name_base, name_raw, variant, group_label, needs_review) VALUES
{",\n".join(drug_rows)}
ON CONFLICT (name_raw) DO NOTHING;

-- (4) Seed dịch vụ/CLS NEW → service_price (group='dich_vu', giá NULL). KHÔNG đụng rows cũ.
INSERT INTO service_price (service_code, name, "group", category, tang) VALUES
{",\n".join(svc_rows)}
ON CONFLICT ("group", service_code) DO NOTHING;

COMMIT;
"""

    down = """-- DOWN 051 — gỡ drug_catalog + cột CLS thêm vào service_price + rows CLS seed.
BEGIN;
DROP TABLE IF EXISTS drug_catalog;
-- xoá đúng các dòng CLS seed (service_code CLS_*), KHÔNG đụng rows nhập tay khác
DELETE FROM service_price WHERE "group" = 'dich_vu' AND service_code LIKE 'CLS\\_%';
ALTER TABLE service_price DROP COLUMN IF EXISTS category;
ALTER TABLE service_price DROP COLUMN IF EXISTS tang;
COMMIT;
"""

    with open(MIG, "w", encoding="utf-8") as f:
        f.write(up)
    with open(MIG_DOWN, "w", encoding="utf-8") as f:
        f.write(down)
    print(f"WROTE {MIG}  ({len(svc_rows)} services, {len(drug_rows)} drugs)")
    print(f"WROTE {MIG_DOWN}")


if __name__ == "__main__":
    main()
