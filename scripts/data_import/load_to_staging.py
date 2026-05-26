"""Load staged CSV → a TRANSIENT Postgres schema (dry-run, rolled back).

P-IMPORT LOAD step (PHẦN 1 — staging dry-run, KHÔNG promote prod).

This script proves the staged CSVs from T-TRANSFORM-01 can be loaded end-to-end
under the real schema, in the correct FK order, with 0 FK violations. It uses the
SAME transient-schema pattern as ``src/tests/test_migrations_014.py::temp_schema_db``:

    CREATE SCHEMA <transient>  →  SET search_path  →  run all migrations in a tx
    →  seed master rows  →  load patient/appointment/visit/clinical_record/lab_result
    →  verify counts + FK orphans  →  tx.ROLLBACK + DROP SCHEMA CASCADE.

SAFETY
- NEVER writes to ``public`` / prod tables — everything happens inside the
  transient schema and the wrapping transaction is rolled back.
- ``prescription`` is PARKED (no target table in schema v6) → not loaded.
- REVIEW_CONFLICT patients (210) AND every child row pointing at those
  clinic_patient_ids are SKIPPED (2nd-pass load after manual adjudication).

USAGE
    poetry run python scripts/data_import/load_to_staging.py
"""

from __future__ import annotations

import asyncio
import csv
import logging
import os
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

logger = logging.getLogger("data_import.load_to_staging")

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "src" / "migrations"
STAGED_DIR = REPO_ROOT / "scripts" / "data_migration" / "output"

SCHEMA_NAME = "import_staging_dryrun"
PATIENT_CODE_LOCK_KEY = 778_899  # arbitrary constant for pg_advisory_xact_lock
PATIENT_CODE_YEAR = 2026
DEFAULT_SLOT_MINUTES = 30

# Vietnamese appointment status → schema enum.
_STATUS_MAP = {
    "Đã đến": "COMPLETED",
    "Không đến": "NO_SHOW",
    "Chưa đến": "SCHEDULED",
    "Chưa đến ngày hẹn khám": "SCHEDULED",
    "": "SCHEDULED",
}


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _nn(value: str | None) -> str | None:
    """Empty / whitespace string → None (NULL); else the trimmed value."""
    if value is None:
        return None
    v = value.strip()
    return v or None


def _uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)


def _parse_date(value: str | None) -> date | None:
    v = _nn(value)
    if v is None:
        return None
    try:
        return date.fromisoformat(v)
    except ValueError:
        return None


def _parse_dt(value: str | None) -> datetime | None:
    v = _nn(value)
    if v is None:
        return None
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return None


def _load_csv(name: str) -> list[dict[str, str]]:
    path = STAGED_DIR / f"{name}_staged.csv"
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


async def _run_all_migrations_in_tx(conn: asyncpg.Connection) -> None:
    """Run every up-migration .sql in order inside the active transaction.

    Mirrors tests/test_migrations_014.py::run_all_migrations_in_tx — strips the
    per-file BEGIN/COMMIT so all DDL stays in the outer (rolled-back) tx.
    """
    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)
    up_files = [
        f
        for f in sql_files
        if not f.name.endswith(".down.sql") and f.name.startswith("2026")
    ]
    for f in up_files:
        content = f.read_text(encoding="utf-8")
        cleaned = re.sub(r"^\s*BEGIN\s*;\s*", "", content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*COMMIT\s*;\s*$", "", cleaned, flags=re.IGNORECASE)
        await conn.execute(cleaned)


# --------------------------------------------------------------------------- #
# seed + load steps
# --------------------------------------------------------------------------- #
async def _seed_master(conn: asyncpg.Connection) -> tuple[uuid.UUID, uuid.UUID]:
    """Seed one default clinic_location + one fallback service_type.

    Returns (location_id, service_type_id) for the FK columns. Dr4women runs a
    single physical clinic today; location_id stays a column for future growth.
    Service-type raw→catalog mapping is deferred → everything maps to 'KHAC'.
    """
    location_id = await conn.fetchval(
        """
        INSERT INTO clinic_location (code, name, address, is_active)
        VALUES ('KN', 'Kim Ngưu', '99 Kim Ngưu, Hai Bà Trưng, Hà Nội', TRUE)
        RETURNING id
        """
    )
    service_type_id = await conn.fetchval(
        """
        INSERT INTO service_type (code, name, default_duration_minutes, is_active)
        VALUES ('KHAC', 'Khác (chưa phân loại)', 30, TRUE)
        RETURNING id
        """
    )
    return location_id, service_type_id


async def _load_patients(
    conn: asyncpg.Connection,
    patients: list[dict[str, str]],
    rc_ids: set[str],
    location_id: uuid.UUID,
) -> int:
    """Insert SINGLE + AUTO_MERGE patients; generate patient_code under an
    advisory lock; skip REVIEW_CONFLICT.
    """
    # Serialise patient_code allocation (app-side counter, no DB sequence).
    await conn.execute("SELECT pg_advisory_xact_lock($1)", PATIENT_CODE_LOCK_KEY)

    rows = []
    seq = 0
    for r in patients:
        if r["merge_action"] == "REVIEW_CONFLICT":
            continue
        seq += 1
        code = f"BN-{PATIENT_CODE_YEAR}-{seq:06d}"
        rows.append(
            (
                _uuid(r["clinic_patient_id"]),
                code,
                _nn(r["national_id_number"]),
                r["full_name"],
                _parse_date(r["date_of_birth"]),
                _nn(r["phone_primary"]),
                _nn(r["phone_secondary"]),
                location_id,
                r["is_active"].strip().lower() == "true",
            )
        )
    await conn.executemany(
        """
        INSERT INTO patient (
            clinic_patient_id, patient_code, national_id_number, full_name,
            date_of_birth, phone_primary, phone_secondary, location_id, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        rows,
    )
    return len(rows)


async def _load_appointments(
    conn: asyncpg.Connection,
    appts: list[dict[str, str]],
    rc_ids: set[str],
    location_id: uuid.UUID,
    service_type_id: uuid.UUID,
) -> tuple[int, int]:
    """Insert appointments for non-RC patients. Derive slot_end = slot_start +
    30min. Skip rows with no parseable slot_start (NOT NULL). Returns
    (inserted, skipped_no_slot).
    """
    rows = []
    skipped_no_slot = 0
    for r in appts:
        if r["clinic_patient_id"] in rc_ids:
            continue
        slot_start = _parse_dt(r["slot_start"])
        if slot_start is None:
            skipped_no_slot += 1
            continue
        slot_end = slot_start + timedelta(minutes=DEFAULT_SLOT_MINUTES)
        status = _STATUS_MAP.get(r["status_raw"].strip(), "SCHEDULED")
        rows.append(
            (
                _uuid(r["clinic_patient_id"]),
                location_id,
                service_type_id,
                _nn(r["booking_channel_raw"]),
                slot_start,
                slot_end,
                status,
                _nn(r["note"]),
            )
        )
    await conn.executemany(
        """
        INSERT INTO appointment (
            clinic_patient_id, location_id, service_type_id, booking_channel,
            slot_start, slot_end, status, cancellation_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        """,
        rows,
    )
    return len(rows), skipped_no_slot


async def _load_clinical(
    conn: asyncpg.Connection,
    clinical: list[dict[str, str]],
    rc_ids: set[str],
    location_id: uuid.UUID,
) -> tuple[int, int]:
    """Create one visit parent per clinical_record (1:1), then the
    clinical_record. Returns (visits, clinical_records)."""
    visit_rows = []
    clinical_rows = []
    for r in clinical:
        if r["clinic_patient_id"] in rc_ids:
            continue
        visit_id = uuid.uuid4()
        visit_rows.append(
            (visit_id, _uuid(r["clinic_patient_id"]), "OPEN", location_id)
        )
        clinical_rows.append((visit_id, _nn(r["chief_complaint"])))

    await conn.executemany(
        """
        INSERT INTO visit (visit_id, clinic_patient_id, status, location_id)
        VALUES ($1,$2,$3,$4)
        """,
        visit_rows,
    )
    await conn.executemany(
        """
        INSERT INTO clinical_record (visit_id, chief_complaint_at_visit)
        VALUES ($1,$2)
        """,
        clinical_rows,
    )
    return len(visit_rows), len(clinical_rows)


async def _load_labs(
    conn: asyncpg.Connection,
    labs: list[dict[str, str]],
    rc_ids: set[str],
) -> int:
    """Insert lab_results for non-RC patients (appointment_id/visit_id left
    NULL — raw refs unresolved)."""
    rows = []
    for r in labs:
        if r["clinic_patient_id"] in rc_ids:
            continue
        rows.append(
            (
                _uuid(r["clinic_patient_id"]),
                r["test_code"].strip() or "UNKNOWN",
                r["test_name"].strip() or "UNKNOWN",
                _nn(r["panel_code"]),
                _nn(r["result_value"]),
                _nn(r["result_unit"]),
                (r["triage_group"].strip() or "PENDING"),
                _nn(r["lab_provider"]),
                _nn(r["external_ref"]),
            )
        )
    await conn.executemany(
        """
        INSERT INTO lab_result (
            clinic_patient_id, test_code, test_name, panel_code,
            result_value, result_unit, triage_group, lab_provider, external_ref
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        """,
        rows,
    )
    return len(rows)


async def _count(conn: asyncpg.Connection, table: str) -> int:
    return int(await conn.fetchval(f"SELECT count(*) FROM {table}"))


async def _fk_orphans(conn: asyncpg.Connection) -> int:
    """Belt-and-braces orphan check (DB FKs already guarantee 0; this surfaces
    any logic gap as an explicit number)."""
    total = 0
    total += int(
        await conn.fetchval(
            "SELECT count(*) FROM appointment a "
            "LEFT JOIN patient p USING (clinic_patient_id) "
            "WHERE p.clinic_patient_id IS NULL"
        )
    )
    total += int(
        await conn.fetchval(
            "SELECT count(*) FROM lab_result l "
            "LEFT JOIN patient p USING (clinic_patient_id) "
            "WHERE p.clinic_patient_id IS NULL"
        )
    )
    total += int(
        await conn.fetchval(
            "SELECT count(*) FROM clinical_record c "
            "LEFT JOIN visit v USING (visit_id) WHERE v.visit_id IS NULL"
        )
    )
    return total


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
async def run() -> int:
    load_dotenv()
    raw_dsn = os.getenv("DATABASE_URL")
    if not raw_dsn:
        logger.error("DATABASE_URL not set — cannot run staging dry-run.")
        return 2
    dsn = raw_dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    patients = _load_csv("patient")
    appts = _load_csv("appointment")
    labs = _load_csv("lab_result")
    clinical = _load_csv("clinical_record")
    rc_ids = {
        r["clinic_patient_id"]
        for r in patients
        if r["merge_action"] == "REVIEW_CONFLICT"
    }
    logger.info("REVIEW_CONFLICT patients to skip: %d", len(rc_ids))

    conn = await asyncpg.connect(dsn)
    await conn.execute(f"DROP SCHEMA IF EXISTS {SCHEMA_NAME} CASCADE;")
    await conn.execute(f"CREATE SCHEMA {SCHEMA_NAME};")
    await conn.execute(f"SET search_path TO {SCHEMA_NAME};")

    tx = conn.transaction()
    await tx.start()
    fk_fail = -1
    counts: dict[str, int] = {}
    skipped_no_slot = 0
    try:
        await _run_all_migrations_in_tx(conn)
        location_id, service_type_id = await _seed_master(conn)

        await _load_patients(conn, patients, rc_ids, location_id)
        _, skipped_no_slot = await _load_appointments(
            conn, appts, rc_ids, location_id, service_type_id
        )
        await _load_clinical(conn, clinical, rc_ids, location_id)
        await _load_labs(conn, labs, rc_ids)

        counts = {
            "patient": await _count(conn, "patient"),
            "appointment": await _count(conn, "appointment"),
            "visit": await _count(conn, "visit"),
            "clinical_record": await _count(conn, "clinical_record"),
            "lab_result": await _count(conn, "lab_result"),
        }
        fk_fail = await _fk_orphans(conn)
        _report(counts, fk_fail, skipped_no_slot)
    finally:
        await tx.rollback()
        await conn.execute(f"DROP SCHEMA IF EXISTS {SCHEMA_NAME} CASCADE;")
        await conn.close()
        logger.info(
            "rolled back tx + dropped schema %s (nothing persisted)", SCHEMA_NAME
        )

    return 0 if fk_fail == 0 else 1


def _report(counts: dict[str, int], fk_fail: int, skipped_no_slot: int) -> None:
    expected = {
        "patient": 5518,
        "appointment": 9312 - skipped_no_slot,
        "visit": 5583,
        "clinical_record": 5583,
        "lab_result": 4724,
    }
    print("\n=== STAGING DRY-RUN — count KỲ VỌNG vs THẬT ===")
    print(f"{'table':<18}{'expected':>10}{'actual':>10}{'ok':>5}")
    for t in ("patient", "appointment", "visit", "clinical_record", "lab_result"):
        exp, act = expected[t], counts.get(t, -1)
        print(f"{t:<18}{exp:>10}{act:>10}{'✓' if exp == act else '✗':>5}")
    print(f"\nappointment skipped (no slot_start): {skipped_no_slot}")
    print(f"FK orphan count (expected 0): {fk_fail}")
    print("prescription: PARKED (no target table) — not loaded")
    print("================================================\n")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    raise SystemExit(asyncio.run(run()))
