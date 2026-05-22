"""Sample ETL: extract 30 clean patients from the admin (hành chính) CSV.

Step 1/3 of the demo seed pipeline (Task A). Reads the Notion-exported admin
CSV, normalises 6 columns, drops rows missing the mandatory identifiers
(phone + full_name), and writes the first 30 cleaned records to
``scripts/seed/seed_sample.json``.

This script does NOT touch the database — Task B will read the JSON and
insert via ``patient_service``.

PRIVACY
-------
- Source CSV is patient data and MUST stay outside the repo (caller passes
  the absolute path via ``--input``).
- ``seed_sample.json`` also contains real patient names/phones; it is
  gitignored and must never be committed.

USAGE
-----
    poetry run python scripts/seed/sample_from_csv.py \\
        --input "/abs/path/to/hành chính.csv"
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger("seed.sample_from_csv")

# Default points at the Notion export Tuyền provided for P-IMPORT-0.
# Primary snapshot version, NOT the `_all` subpages-expanded one (packet boundary).
DEFAULT_INPUT = Path(
    "/Users/quangdang/Documents/ClinicAI/Data khách gửi/"
    "File khách hàng ( hành chính )/"
    "🔑 File khách hàng (hành chính) 253c357e836d8042bfb8e00569064b9b.csv"
)
DEFAULT_OUTPUT = Path("scripts/seed/seed_sample.json")
SAMPLE_SIZE = 30

# Source-column → semantic role. Names verified against PROFILE_REPORT.md.
COL_NAME = "//họ tên (neat)"
COL_PHONE = "//sdt (neat)"
COL_DOB = "Ngày sinh"
COL_GENDER = "Giới tính"
COL_ADDRESS = "Địa chỉ"
COL_EXTERNAL_ID = "*ID"

REQUIRED_COLUMNS: tuple[str, ...] = (
    COL_NAME,
    COL_PHONE,
    COL_DOB,
    COL_GENDER,
    COL_ADDRESS,
    COL_EXTERNAL_ID,
)

GENDER_MAP = {
    "nữ": "female",
    "nu": "female",
    "nam": "male",
}


def _is_blank(v: Any) -> bool:
    """Treat NaN, None, and empty/whitespace strings as missing."""
    if v is None:
        return True
    if isinstance(v, float) and pd.isna(v):
        return True
    if isinstance(v, str) and v.strip() == "":
        return True
    return False


def _normalise_phone(raw: Any) -> str | None:
    """Strip whitespace, keep digits + leading 0. Return None on blank/garbled."""
    if _is_blank(raw):
        return None
    s = str(raw).strip()
    # Keep only digits — Notion sometimes embeds dots/spaces ("0912 345 678").
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return None
    return digits


def _parse_dob(raw: Any) -> str | None:
    """Parse "DD/MM/YYYY" (or "DD/MM/YYYY HH:MM …") → ISO "YYYY-MM-DD".

    Returns None on parse failure (caller keeps the row, just nulls the field).
    """
    if _is_blank(raw):
        return None
    s = str(raw).strip()
    # The Notion export sometimes appends "12:00 AM (GMT+7)" — take only the date head.
    date_part = s.split(" ")[0] if " " in s else s
    try:
        parsed = datetime.strptime(date_part, "%d/%m/%Y")
    except ValueError:
        return None
    return parsed.date().isoformat()


def _map_gender(raw: Any) -> str:
    """Normalise gender label. Unknown values collapse to 'unknown'."""
    if _is_blank(raw):
        return "unknown"
    key = str(raw).strip().lower()
    return GENDER_MAP.get(key, "unknown")


def _clean_text(raw: Any) -> str | None:
    if _is_blank(raw):
        return None
    return str(raw).strip()


def load_csv(path: Path) -> pd.DataFrame:
    """Read the admin CSV via pandas. Forces dtype=str so we control parsing."""
    if not path.is_file():
        raise FileNotFoundError(f"input CSV not found: {path}")
    return pd.read_csv(path, dtype=str, keep_default_na=True, low_memory=False)


def transform_rows(df: pd.DataFrame) -> tuple[list[dict[str, Any]], Counter[str]]:
    """Apply column projection + cleaning. Returns (records, reject_reasons)."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise KeyError(f"CSV missing required columns: {missing}")

    records: list[dict[str, Any]] = []
    rejects: Counter[str] = Counter()

    for _, row in df[list(REQUIRED_COLUMNS)].iterrows():
        full_name = _clean_text(row[COL_NAME])
        phone = _normalise_phone(row[COL_PHONE])

        if full_name is None and phone is None:
            rejects["missing_both_name_and_phone"] += 1
            continue
        if full_name is None:
            rejects["missing_full_name"] += 1
            continue
        if phone is None:
            rejects["missing_phone"] += 1
            continue

        records.append(
            {
                "full_name": full_name,
                "phone_primary": phone,
                "date_of_birth": _parse_dob(row[COL_DOB]),
                "gender": _map_gender(row[COL_GENDER]),
                "address": _clean_text(row[COL_ADDRESS]),
                "external_code": _clean_text(row[COL_EXTERNAL_ID]),
                "national_id_number": None,
            }
        )

    return records, rejects


def write_sample(records: list[dict[str, Any]], out_path: Path, n: int) -> int:
    """Write the first `n` records as JSON. Returns the count actually written."""
    sample = records[:n]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return len(sample)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Absolute path to admin CSV (default: {DEFAULT_INPUT}).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"JSON output path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=SAMPLE_SIZE,
        help=f"How many cleaned rows to emit (default: {SAMPLE_SIZE}).",
    )
    args = parser.parse_args(argv)

    df = load_csv(args.input)
    total_read = len(df)
    records, rejects = transform_rows(df)
    valid = len(records)
    written = write_sample(records, args.output, args.sample_size)

    rejected_total = sum(rejects.values())
    print("=== Sample ETL summary ===")
    print(f"Input file       : {args.input}")
    print(f"Output file      : {args.output}")
    print(f"Total rows read  : {total_read}")
    print(f"Valid rows       : {valid}")
    print(f"Rejected rows    : {rejected_total}")
    for reason, count in sorted(rejects.items()):
        print(f"  - {reason}: {count}")
    print(f"Written to JSON  : {written} (requested {args.sample_size})")
    print("==========================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
