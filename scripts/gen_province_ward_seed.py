#!/usr/bin/env python3
"""Sinh seed SQL cho province + ward (T-DASH-ADDRESS-DROPDOWN-01).

Nguồn: github.com/ThangLeQuoc/vietnamese-provinces-database, tag GHIM v3.1.0
(cấu trúc SAU sáp nhập: tỉnh → phường/xã, BỎ huyện). 34 tỉnh + 3321 ward.

Chạy:  python scripts/gen_province_ward_seed.py > src/migrations/seed/054_province_ward.sql
Regen khi đổi tag: sửa SRC_URL. Seed idempotent (ON CONFLICT DO NOTHING).
"""
from __future__ import annotations

import json
import sys
import urllib.request

SRC_URL = (
    "https://raw.githubusercontent.com/thanglequoc/"
    "vietnamese-provinces-database/v3.1.0/json/"
    "simplified_json_generated_data_vn_units.json"
)
BATCH = 500


def sql_str(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def emit_inserts(table: str, cols: list[str], rows: list[tuple]) -> None:
    if not rows:
        return
    collist = ", ".join(cols)
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        print(f"INSERT INTO {table} ({collist}) VALUES")
        lines = [
            "  (" + ", ".join(sql_str(v) for v in r) + ")"
            for r in chunk
        ]
        print(",\n".join(lines))
        print("ON CONFLICT (code) DO NOTHING;\n")


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_URL
    if src.startswith("http"):
        with urllib.request.urlopen(src, timeout=60) as resp:
            data = json.load(resp)
    else:
        data = json.load(open(src))

    provinces = [
        (p["Code"], p["Name"], p["FullName"], p.get("CodeName"))
        for p in data
    ]
    wards = [
        (w["Code"], w["Name"], w["FullName"], w.get("CodeName"), w["ProvinceCode"])
        for p in data
        for w in p["Wards"]
    ]

    print("-- AUTO-GENERATED — gen_province_ward_seed.py (nguồn v3.1.0). KHÔNG sửa tay.")
    print(f"-- {len(provinces)} tỉnh + {len(wards)} phường/xã. Idempotent.\n")
    print("BEGIN;\n")
    emit_inserts("province", ["code", "name", "full_name", "code_name"], provinces)
    emit_inserts(
        "ward",
        ["code", "name", "full_name", "code_name", "province_code"],
        wards,
    )
    print("COMMIT;")


if __name__ == "__main__":
    main()
