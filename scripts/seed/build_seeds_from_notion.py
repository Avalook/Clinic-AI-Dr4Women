"""Generate SQL seed files for ``service_type`` and ``staff`` from Notion.

P-SEED-01 — read-only pull from the cloned PK Notion workspace, write
idempotent INSERT statements into ``src/migrations/seed/``. The output
files can then be applied with ``psql -f``.

WHY NOT HARD-CODE
- ``src/migrations/seed/004_staff.sql`` (the original) has 29 hard-coded
  staff that drift from the live PK roster (Notion lib 3 has ~46 NV).
- ``service_type`` had no seed file at all (only one ``TEST-SVC`` test
  row in dev DB). Generating from the canonical Notion option list keeps
  the seed in sync with what PK actually uses.

MAPPING RULES (documented; surfaced in the generated SQL header)
- ``service_type.code`` = ASCII-uppercased, underscore-joined ``name``
  (e.g. ``'Phụ khoa'`` → ``'PHU_KHOA'``). ``***#`` prefix on
  ``'***#Thủ thuật'`` is stripped.
- ``service_type.name`` = Notion option name verbatim (Vietnamese).
- ``service_type.default_duration_minutes`` = 30 (Supabase column default;
  Notion does not store per-service duration).
- ``staff.primary_department`` derived from name + Notion
  ``'Vị trí nhân sự'`` multi_select, mapped into the Supabase CHECK
  constraint enum (DOCTOR / ULTRASOUND_DOCTOR / NURSE_ULTRASOUND /
  RECEPTION / CSKH / MANAGEMENT). See ``_classify_dept``.
- ``staff.short_name`` = ``full_name`` with the leading "BS " /
  "BS SA " prefix stripped (e.g. "BS Thành" → "Thành").
- ``staff.is_active`` = TRUE, ``is_training`` = FALSE, ``employment_type``
  = 'FULL_TIME' (defaults; Notion has no equivalent field).
- ``staff.primary_location_id`` = NULL (Notion "Vị trí ưa thích" is empty
  for every row in the clone).

USAGE
    poetry run python scripts/seed/build_seeds_from_notion.py
    # then:
    psql "$DATABASE_URL" -f src/migrations/seed/003_service_type.sql
    psql "$DATABASE_URL" -f src/migrations/seed/005_staff_from_notion.sql
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from notion_client import AsyncClient

logger = logging.getLogger("seed.build_seeds_from_notion")

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = REPO_ROOT / "src" / "migrations" / "seed"

# Notion data_source IDs (from context/notion_schema_report.md).
LICH_HEN_DS = "d1eccb0e-ac88-820e-bae1-87f9270ea036"  # carries the canonical
# 'Loại dịch vụ khám' select option list, mirrored on Phiếu khám.
LIB_3_DS = "b15ccb0e-ac88-82a3-96fa-072e912b16e0"  # danh sách nhân viên


# --------------------------------------------------------------------------- #
# Normalisation
# --------------------------------------------------------------------------- #


def _ascii_fold(s: str) -> str:
    """Strip Vietnamese diacritics + replace 'đ'/'Đ' → 'd'/'D'."""
    # NFD → strip combining marks → re-compose. Handles all Vietnamese tones.
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("đ", "d").replace("Đ", "D")


def _code_from_name(name: str) -> str:
    """``'***#Thủ thuật'`` → ``'THU_THUAT'``; ``'Sản 1'`` → ``'SAN_1'``."""
    # Strip non-alphanumeric prefixes (***#, etc.).
    s = re.sub(r"^[^\w]+", "", name)
    s = _ascii_fold(s).upper()
    # Replace any run of non-[A-Z0-9] with underscore, then trim.
    s = re.sub(r"[^A-Z0-9]+", "_", s).strip("_")
    return s


def _short_name(full_name: str) -> str:
    """``'BS Thành'`` → ``'Thành'``; ``'BS SA Hoàng'`` → ``'Hoàng'``."""
    for prefix in ("BS SA ", "BS "):
        if full_name.startswith(prefix):
            return full_name[len(prefix) :].strip()
    return full_name.strip()


# --------------------------------------------------------------------------- #
# Department classifier — Notion dept text → Supabase enum
# --------------------------------------------------------------------------- #

_VALID_DEPTS = {
    "DOCTOR",
    "ULTRASOUND_DOCTOR",
    "NURSE_ULTRASOUND",
    "RECEPTION",
    "CSKH",
    "MANAGEMENT",
}

# Notion lib 3 also contains template/role-name rows that are not people.
# These cannot be detected by the "[Master page]" prefix used elsewhere,
# so they are listed here explicitly. Re-run the generator if PK adds new
# template rows.
_JOB_ROLE_TEMPLATES = {
    "Admin",
    "Lễ tân - Thu ngân",
    "Phụ + Thuốc bs Thành",
    "Trợ lý BS Thành",
    "Điều dưỡng siêu âm",
    "Điều dưỡng sản",
}


def _classify_dept(full_name: str, notion_depts: list[str]) -> str:
    """Map Notion department label(s) to the Supabase CHECK enum.

    Rule order (first match wins):
    1. Title starts with 'BS SA ' → ULTRASOUND_DOCTOR (siêu âm doctor).
    2. Title starts with 'BS '    → DOCTOR.
    3. Title starts with 'ĐD ' AND only 'Lễ tân' in Notion dept → RECEPTION.
    4. Title starts with 'ĐD ' or 'TL ' → NURSE_ULTRASOUND.
    5. Notion dept contains 'Điều dưỡng siêu âm' / 'Điều dưỡng sản'
       / 'Phụ + Thuốc' / 'Trợ lý' → NURSE_ULTRASOUND.
    6. Notion dept contains 'Lễ tân' → RECEPTION.
    7. fallback → CSKH (best guess for unprefixed name + empty dept;
       PK normally adds CSKH/Marketing staff without prefix).
    """
    if full_name.startswith("BS SA "):
        return "ULTRASOUND_DOCTOR"
    if full_name.startswith("BS "):
        return "DOCTOR"
    if full_name.startswith("ĐD "):
        # An ĐD whose only dept entry is 'Lễ tân - Thu ngân' is a
        # receptionist who happens to also be cross-trained on nursing.
        if notion_depts == ["Lễ tân - Thu ngân"]:
            return "RECEPTION"
        return "NURSE_ULTRASOUND"
    if full_name.startswith("TL "):
        return "NURSE_ULTRASOUND"
    joined = " | ".join(notion_depts)
    if "Điều dưỡng siêu âm" in joined:
        return "NURSE_ULTRASOUND"
    if "Điều dưỡng sản" in joined:
        return "NURSE_ULTRASOUND"
    if "Phụ + Thuốc" in joined or "Trợ lý" in joined:
        return "NURSE_ULTRASOUND"
    if "Lễ tân" in joined:
        return "RECEPTION"
    return "CSKH"


# --------------------------------------------------------------------------- #
# Notion pulls
# --------------------------------------------------------------------------- #


async def _pull_service_options(notion: AsyncClient) -> list[dict[str, str]]:
    ds = await notion.data_sources.retrieve(data_source_id=LICH_HEN_DS)
    opts = ds["properties"]["Loại dịch vụ khám"]["select"]["options"]
    return [{"name": o["name"], "notion_id": o["id"]} for o in opts]


async def _pull_staff(notion: AsyncClient) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        kw: dict[str, Any] = {"data_source_id": LIB_3_DS, "page_size": 100}
        if cursor:
            kw["start_cursor"] = cursor
        resp = await notion.data_sources.query(**kw)
        rows.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")

    kept: list[dict[str, Any]] = []
    for r in rows:
        props = r["properties"]
        title_parts = (props.get("Name") or {}).get("title") or []
        name = "".join(p.get("plain_text", "") for p in title_parts).strip()
        if not name or "[Master page]" in name:
            continue
        if name in _JOB_ROLE_TEMPLATES:
            # Lib 3 contains role-name rows ("Admin", "Lễ tân - Thu ngân",
            # …) used as relation targets, not real people; drop them.
            continue
        ms = (props.get("Vị trí nhân sự") or {}).get("multi_select") or []
        depts = [o.get("name", "") for o in ms]
        kept.append(
            {
                "notion_page_id": r["id"],
                "full_name": name,
                "notion_depts": depts,
            }
        )
    return kept


# --------------------------------------------------------------------------- #
# SQL emission
# --------------------------------------------------------------------------- #


def _sql_quote(s: str) -> str:
    """Escape a string for embedding in single-quoted SQL literal."""
    return s.replace("'", "''")


def _emit_service_type_sql(services: list[dict[str, str]]) -> str:
    rows: list[str] = []
    seen_codes: set[str] = set()
    total = len(services)
    for i, s in enumerate(services):
        code = _code_from_name(s["name"])
        if code in seen_codes:
            # Disambiguate by appending a numeric suffix; never silently merge.
            j = 2
            while f"{code}_{j}" in seen_codes:
                j += 1
            code = f"{code}_{j}"
        seen_codes.add(code)
        # Place the comma BEFORE the trailing comment — otherwise the SQL
        # line comment (`--`) swallows it and the VALUES list is broken.
        sep = "," if i < total - 1 else ""
        rows.append(
            f"  ('{_sql_quote(code)}', '{_sql_quote(s['name'])}', 30){sep}"
            f"  -- notion option_id={s['notion_id']}"
        )

    body = "\n".join(rows)
    return (
        "-- Generated by scripts/seed/build_seeds_from_notion.py.\n"
        "-- Source: Notion 'LỊCH HẸN' / 'Loại dịch vụ khám' select options.\n"
        "-- code = ASCII-upper-underscore of name (***# prefix stripped).\n"
        "-- name = Notion option name verbatim.\n"
        "-- Re-runnable: ON CONFLICT (code) DO NOTHING.\n\n"
        "BEGIN;\n\n"
        "INSERT INTO service_type (code, name, default_duration_minutes) VALUES\n"
        f"{body}\n"
        "ON CONFLICT (code) DO NOTHING;\n\n"
        "COMMIT;\n"
    )


def _emit_staff_sql(staff: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for s in staff:
        full = s["full_name"]
        short = _short_name(full)
        dept = _classify_dept(full, s["notion_depts"])
        if dept not in _VALID_DEPTS:
            raise AssertionError(f"Bad dept {dept!r} for {full!r}")
        notion_id = s["notion_page_id"]
        lines.append(
            "  IF NOT EXISTS (SELECT 1 FROM staff WHERE full_name = "
            f"'{_sql_quote(full)}') THEN\n"
            "    INSERT INTO staff (id, full_name, short_name, "
            "primary_department, primary_location_id, employment_type, "
            "is_training, is_active) VALUES (gen_random_uuid(), "
            f"'{_sql_quote(full)}', '{_sql_quote(short)}', '{dept}', "
            "NULL, 'FULL_TIME', FALSE, TRUE);  -- notion " + notion_id + "\n"
            "  END IF;"
        )

    body = "\n".join(lines)
    return (
        "-- Generated by scripts/seed/build_seeds_from_notion.py.\n"
        "-- Source: Notion 'lib 3 - danh sách nhân viên' rows "
        "(master pages filtered out).\n"
        "-- primary_department mapping rules: see _classify_dept in generator.\n"
        "-- short_name = full_name with 'BS '/'BS SA ' prefix stripped.\n"
        "-- primary_location_id = NULL (Notion 'Vị trí ưa thích' empty for all).\n"
        "-- Re-runnable: each INSERT guarded by IF NOT EXISTS on full_name.\n\n"
        "BEGIN;\n\n"
        "DO $$\n"
        "BEGIN\n"
        f"{body}\n"
        "END\n"
        "$$;\n\n"
        "COMMIT;\n"
    )


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


async def main() -> None:
    load_dotenv(REPO_ROOT / ".env")
    token = os.environ.get("NOTION_API_KEY")
    if not token:
        raise SystemExit("NOTION_API_KEY not set; cannot proceed.")
    notion = AsyncClient(auth=token)

    print(">> Pulling service_type options from LỊCH HẸN …")
    services = await _pull_service_options(notion)
    print(f"   got {len(services)} service options")

    print(">> Pulling staff from lib 3 …")
    staff = await _pull_staff(notion)
    print(f"   got {len(staff)} staff (after dropping master pages)")

    # Surface mapping breakdown so a human can sanity-check before applying.
    from collections import Counter

    dept_count: Counter[str] = Counter()
    for s in staff:
        dept_count[_classify_dept(s["full_name"], s["notion_depts"])] += 1
    print("\n   Department mapping (Supabase enum → row count):")
    for d, n in dept_count.most_common():
        print(f"     {d:<20s} {n}")
    print()

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    svc_path = SEED_DIR / "003_service_type.sql"
    staff_path = SEED_DIR / "005_staff_from_notion.sql"

    svc_path.write_text(_emit_service_type_sql(services), encoding="utf-8")
    staff_path.write_text(_emit_staff_sql(staff), encoding="utf-8")
    print(f">> Wrote {svc_path.relative_to(REPO_ROOT)}")
    print(f">> Wrote {staff_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(main())
