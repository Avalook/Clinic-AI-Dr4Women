"""Read the PK-exported CSV bundle into the shape ``transform.transform``
expects.

Why this exists
---------------
The Notion adapter (``notion_to_sources.py``) reads the cloned workspace,
which is missing every cross-DB relation because Notion's
``Duplicate page`` strips the inter-database target UUIDs. The cloned
``Xét nghiệm`` rows therefore have empty ``🔑 File bệnh nhân`` /
``Phiếu khám`` link cells; transform.py's ``map_lab_results`` rejects
every row because it cannot extract a phone.

The CSV bundle PK sent (``Data khách gửi/<dataset>/*_all.csv``) was
exported straight from prod Notion BEFORE the duplicate. Relation cells
in the export are textual ``"Name SDT (https://notion.so/...)"`` strings
— ``extract_phone`` in transform.py was designed for exactly this shape.
Switching the source from the clone to these CSVs recovers:

* ``lab_result`` rows (5k+ previously empty in Supabase),
* ``prescription`` (will populate once the schema exists),
* a fuller ``appointment``/``visit``/``clinical_record`` count.

Datasets covered (the 5 keys ``transform.transform`` reads)
----------------------------------------------------------
* ``admin``        — File khách hàng (hành chính)/*_all.csv   (6 090 rows)
* ``clinical``     — File bệnh nhân lâm sàng/*_all.csv         (6 182 rows)
* ``appointment``  — Lịch hẹn/*_all.csv                         (10 032 rows)
* ``lab``          — Xét nghiệm/*_all.csv                       (5 033 rows)
* ``prescription`` — Kê thuốc/*_all.csv                         (15 415 rows)

CSKH Action (31 179 rows) and Dịch vụ (15 075 rows) are NOT part of the
``transform.transform`` contract — they need their own loaders against
the new ``cskh_action`` and ``service_log`` tables (migrations 029/030).

SAFETY
- READ-ONLY against the CSV dir.
- File encoding is ``utf-8-sig`` (the export includes a BOM).
- ``csv.DictReader`` handles newlines inside quoted cells; do NOT switch
  to pandas' C engine — it breaks on the PK formulas that contain
  literal newlines.
"""

from __future__ import annotations

import csv
import logging
from pathlib import Path

logger = logging.getLogger("data_import.csv_to_sources")

# Default sibling of the repo. Override with ``--csv-dir`` on the sync
# runner if the bundle lives elsewhere.
DEFAULT_CSV_ROOT = Path(__file__).resolve().parents[3] / "Data khách gửi"

# Mapping: transform key → folder name as PK ships it (Vietnamese,
# emoji-prefixed in some cases). Folders contain both ``*.csv`` (base,
# sometimes filtered) and ``*_all.csv`` (full); we always prefer
# ``_all.csv`` per CURRENT_PROGRESS guidance.
DATASETS: dict[str, str] = {
    "admin": "File khách hàng ( hành chính )",
    "clinical": "File bệnh nhân lâm sàng",
    "appointment": "Lịch hẹn",
    "lab": "Xét nghiệm",
    "prescription": "Kê thuốc",
    # E2c: extras consumed by sync_to_supabase directly (not by transform.py).
    "cskh_action": "CSKH Action",
    "service": "Dịch vụ",
}


def _pick_all_csv(folder: Path) -> Path:
    candidates = sorted(folder.glob("*_all.csv"))
    if not candidates:
        # PK occasionally ships only a base CSV (rare); fall back so the
        # sync does not crash silently.
        candidates = sorted(folder.glob("*.csv"))
    if not candidates:
        raise FileNotFoundError(f"no CSV in {folder}")
    return candidates[0]


def _read_csv(path: Path, *, limit: int | None) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            # csv.DictReader returns None for missing fields when the row
            # has fewer cells than the header — normalise to empty
            # strings so transform.py's ``.get()`` calls behave the same
            # as on the Notion-adapter dicts.
            rows.append({k: (v if v is not None else "") for k, v in row.items()})
            if limit is not None and len(rows) >= limit:
                break
    return rows


def csv_to_sources(
    csv_root: Path | None = None,
    *,
    limit_per_source: int | None = None,
) -> dict[str, list[dict[str, str]]]:
    """Build the ``{key: list[row]}`` mapping ``transform.transform`` wants.

    ``csv_root`` defaults to ``<repo>/../Data khách gửi``. ``limit_per_source``
    caps each dataset for smoke testing (mirrors the Notion adapter flag).
    """
    root = csv_root or DEFAULT_CSV_ROOT
    if not root.exists():
        raise FileNotFoundError(
            f"CSV bundle not found at {root}. Pass --csv-dir or move the "
            "'Data khách gửi' folder next to the repo."
        )

    sources: dict[str, list[dict[str, str]]] = {}
    for key, folder_name in DATASETS.items():
        folder = root / folder_name
        if not folder.is_dir():
            raise FileNotFoundError(
                f"missing dataset folder {folder} (key={key!r}). "
                f"The PK bundle should expose: {list(DATASETS.values())}"
            )
        csv_path = _pick_all_csv(folder)
        rows = _read_csv(csv_path, limit=limit_per_source)
        sources[key] = rows
        logger.info("csv_loaded key=%s rows=%d path=%s", key, len(rows), csv_path.name)
    return sources


def main() -> None:
    """``poetry run python scripts/data_import/csv_to_sources.py`` — sanity-print."""
    import argparse

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--csv-dir", type=Path, default=None)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    sources = csv_to_sources(csv_root=args.csv_dir, limit_per_source=args.limit)
    print("\nLoaded counts per source:")
    for k, rows in sources.items():
        print(f"  {k:<14s} {len(rows)} rows")


if __name__ == "__main__":
    main()
