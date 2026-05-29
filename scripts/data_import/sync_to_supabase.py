"""Pull Notion → transform → upsert into Supabase (first-sync version).

PACKET-3 (NOTION-SYNC-01). The single-shot version that takes the cloned
PK Notion workspace and loads it into the live Supabase schema. The
incremental ``last_edited_time``-windowed cron variant is deferred to a
follow-up packet — this script wipes-then-inserts inside one transaction
so a half-finished run rolls back cleanly.

What this script does, in order
-------------------------------
1. Pull all 5 source DBs from Notion via
   ``notion_to_sources.notion_to_sources`` (read-only).
2. Run ``transform.transform`` — clean + MPI dedup by phone + parent /
   child join. Identical rules to the CSV pipeline; the adapter only
   changes the source.
3. Open a single transaction on Supabase. Inside it:

   * Resolve master IDs by name: clinic_location ``Kim Ngưu`` →
     location_id; staff full_name → doctor_id map; service_type name →
     service_type_id map (built from migration 003 — name matches Notion
     option labels exactly).
   * TRUNCATE patient + appointment + visit + clinical_record +
     lab_result CASCADE. This is a first-sync; idempotent upsert by
     ``(phone, name_key)`` ships with the cron follow-up.
   * INSERT patients (SINGLE + AUTO_MERGE, skip REVIEW_CONFLICT). Allocate
     patient_code under ``pg_advisory_xact_lock`` so concurrent runs
     never collide on the BN-YYYY-XXXXXX counter.
   * INSERT appointments — resolve doctor_id and service_type_id by
     name; fall back to NULL for doctor and to a sentinel service when
     the raw text does not match.
   * INSERT visit + clinical_record pairs (1:1, synthetic visit_id).
   * INSERT lab_results.

4. Commit; print a report; write counters / review_queue / rejects to
   ``context/notion_sync_report.md`` and ``output_dir`` CSVs for audit.

SAFETY
- Reads Notion only via the read-only adapter; never POST/PATCH.
- All writes happen inside one ``async with conn.transaction():`` block;
  a single failure rolls back the entire load.
- Skips ``REVIEW_CONFLICT`` patients (same-phone-different-name); their
  child rows are also dropped to avoid orphans. See
  ``context/notion_schema_report.md`` for the volume.
- ``prescription`` is parked: the schema has no target table.
- ``--dry-run`` flag stops short of the COMMIT so an operator can verify
  counts before the data actually lands.

USAGE
    poetry run python scripts/data_import/sync_to_supabase.py --dry-run
    poetry run python scripts/data_import/sync_to_supabase.py
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import asyncpg
from dotenv import load_dotenv
from notion_client import AsyncClient

# Reuse the canon transform — same MPI rule, same join policy.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_import.notion_to_sources import notion_to_sources  # noqa: E402
from data_migration.transform import (  # noqa: E402
    TransformResult,
    norm_phone,
    transform,
)

logger = logging.getLogger("data_import.sync_to_supabase")

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = REPO_ROOT / "context" / "notion_sync_report.md"

# Vietnamese appointment status text → schema enum. Copied from
# load_to_staging.py so the two pipelines map identically.
_STATUS_MAP: dict[str, str] = {
    "Đã đến": "COMPLETED",
    "Không đến": "NO_SHOW",
    "Chưa đến": "SCHEDULED",
    "Chưa đến ngày hẹn khám": "SCHEDULED",
    "": "SCHEDULED",
}

PATIENT_CODE_LOCK_KEY = 778_899  # arbitrary constant, matches load_to_staging
PATIENT_CODE_YEAR = 2026
DEFAULT_SLOT_MINUTES = 30
TARGET_TABLES = (
    "appointment",
    "lab_result",
    "clinical_record",
    "visit",
    "patient",
)


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #


def _nn(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return v or None


def _parse_date(value: str | None) -> Any:
    v = _nn(value)
    if v is None:
        return None
    try:
        return datetime.fromisoformat(v).date()
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


# --------------------------------------------------------------------------- #
# Master-data resolution                                                      #
# --------------------------------------------------------------------------- #


async def _resolve_master(conn: asyncpg.Connection) -> dict[str, Any]:
    """Build the in-memory lookup tables for the FK columns.

    All three tables are seeded by P1 (ADMIN-RESET-01) — this just turns
    them into dicts the per-row loop can hit without N+1 queries.
    """
    loc_id = await conn.fetchval("SELECT id FROM clinic_location WHERE code = 'KN'")
    if loc_id is None:
        raise RuntimeError("clinic_location 'KN' (Kim Ngưu) not seeded — run P1 first.")

    service_by_name: dict[str, uuid.UUID] = {}
    for row in await conn.fetch("SELECT id, name FROM service_type"):
        service_by_name[row["name"].strip().lower()] = row["id"]
    # Sentinel for rows whose raw text does not match any seeded service.
    default_service = service_by_name.get("free")
    if default_service is None:
        raise RuntimeError(
            "service_type 'FREE' not seeded — re-run "
            "scripts/seed/build_seeds_from_notion.py + apply."
        )

    doctor_by_name: dict[str, uuid.UUID] = {}
    for row in await conn.fetch(
        "SELECT id, full_name FROM staff WHERE primary_department IN "
        "('DOCTOR','ULTRASOUND_DOCTOR')"
    ):
        doctor_by_name[row["full_name"].strip().lower()] = row["id"]

    return {
        "location_id": loc_id,
        "service_by_name": service_by_name,
        "default_service": default_service,
        "doctor_by_name": doctor_by_name,
    }


def _resolve_service(raw: str, master: dict[str, Any]) -> uuid.UUID:
    """Best-effort service_type FK from a raw label."""
    key = raw.strip().lower()
    return master["service_by_name"].get(key, master["default_service"])


def _resolve_doctor(raw: str, master: dict[str, Any]) -> uuid.UUID | None:
    """Best-effort doctor_id FK — NULL when the raw label is empty or unknown."""
    if not raw:
        return None
    key = raw.strip().lower()
    return master["doctor_by_name"].get(key)


# --------------------------------------------------------------------------- #
# Per-table loaders                                                           #
# --------------------------------------------------------------------------- #


async def _truncate_targets(conn: asyncpg.Connection) -> None:
    """Wipe the five demo-scope tables in dependency order via CASCADE."""
    # CASCADE handles FK fan-out (appointment.patient_id, visit.patient_id,
    # clinical_record.visit_id, lab_result.patient_id).
    await conn.execute(
        "TRUNCATE TABLE "
        "appointment, lab_result, clinical_record, visit, patient "
        "RESTART IDENTITY CASCADE"
    )


async def _insert_patients(
    conn: asyncpg.Connection,
    result: TransformResult,
    location_id: uuid.UUID,
) -> tuple[int, set[str]]:
    """Insert non-REVIEW_CONFLICT patients; return (inserted, rc_id_set)."""
    rc_ids: set[str] = set()
    rows: list[tuple[Any, ...]] = []
    await conn.execute("SELECT pg_advisory_xact_lock($1)", PATIENT_CODE_LOCK_KEY)
    seq = 0
    for p in result.patients:
        if p.merge_action == "REVIEW_CONFLICT":
            rc_ids.add(p.clinic_patient_id)
            continue
        seq += 1
        code = f"BN-{PATIENT_CODE_YEAR}-{seq:06d}"
        rows.append(
            (
                uuid.UUID(p.clinic_patient_id),
                code,
                None,  # national_id_number — not in Notion clone
                p.full_name or "(no name)",
                _parse_date(p.date_of_birth),
                norm_phone(p.phone_primary),
                None,  # phone_secondary
                location_id,
                True,  # is_active
            )
        )
    await conn.executemany(
        """INSERT INTO patient (clinic_patient_id, patient_code, national_id_number,
                full_name, date_of_birth, phone_primary, phone_secondary,
                location_id, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
        rows,
    )
    return len(rows), rc_ids


async def _insert_appointments(
    conn: asyncpg.Connection,
    appts: list[dict[str, str]],
    rc_ids: set[str],
    master: dict[str, Any],
) -> tuple[int, int]:
    """Insert appointments, NULL-ing ``doctor_id`` on within-batch overlap.

    Supabase enforces ``appointment_no_doctor_overlap`` — a single doctor
    cannot have two slots that intersect. The cloned Notion data
    occasionally puts two patients on the same doctor + slot (PK overbooks
    in practice and tracks it in a free-form note). To keep the row in
    Supabase without crashing the load, we let the *first* claim of a
    ``(doctor, slot)`` pair keep its doctor_id and NULL the others'
    doctor_id — the appointment still shows on dashboards via patient +
    location filters, just not on per-doctor views. Conflicts counted as
    ``skipped`` so the report surfaces the volume.
    """
    rows: list[tuple[Any, ...]] = []
    skipped = 0
    # Track every accepted (start, end) per doctor; for each new
    # appointment, NULL its doctor_id when ANY accepted interval overlaps.
    # The exclusion constraint uses ``tstzrange [)``, so two appointments
    # overlap iff ``new.start < kept.end and new.end > kept.start``.
    doctor_intervals: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {}
    for r in appts:
        if r["clinic_patient_id"] in rc_ids:
            skipped += 1
            continue
        slot_start = _parse_dt(r.get("slot_start"))
        if slot_start is None:
            skipped += 1
            continue
        slot_end = slot_start + timedelta(minutes=DEFAULT_SLOT_MINUTES)
        status = _STATUS_MAP.get(r.get("status_raw", "").strip(), "SCHEDULED")
        doctor_id = _resolve_doctor(r.get("doctor_raw", ""), master)
        if doctor_id is not None:
            kept = doctor_intervals.setdefault(doctor_id, [])
            overlaps = any(slot_start < end and slot_end > start for start, end in kept)
            if overlaps:
                doctor_id = None
                skipped += 1
            else:
                kept.append((slot_start, slot_end))
        rows.append(
            (
                uuid.UUID(r["clinic_patient_id"]),
                doctor_id,
                master["location_id"],
                _resolve_service(r.get("service_type_raw", ""), master),
                _nn(r.get("booking_channel_raw")),
                slot_start,
                slot_end,
                status,
                _nn(r.get("note")),
            )
        )
    await conn.executemany(
        """INSERT INTO appointment (clinic_patient_id, doctor_id, location_id,
                service_type_id, booking_channel, slot_start, slot_end, status,
                cancellation_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
        rows,
    )
    return len(rows), skipped


async def _insert_visits_and_clinical(
    conn: asyncpg.Connection,
    clinical_rows: list[dict[str, str]],
    rc_ids: set[str],
    master: dict[str, Any],
) -> tuple[int, int]:
    visit_rows: list[tuple[Any, ...]] = []
    clinical_inserts: list[tuple[Any, ...]] = []
    for r in clinical_rows:
        if r["clinic_patient_id"] in rc_ids:
            continue
        vid = uuid.uuid4()
        visit_rows.append(
            (
                vid,
                uuid.UUID(r["clinic_patient_id"]),
                master["location_id"],
                _resolve_service(r.get("service_type_raw", ""), master),
                "OPEN",
            )
        )
        clinical_inserts.append((vid, _nn(r.get("chief_complaint"))))

    await conn.executemany(
        """INSERT INTO visit (visit_id, clinic_patient_id, location_id,
                service_type_id, status)
           VALUES ($1,$2,$3,$4,$5)""",
        visit_rows,
    )
    await conn.executemany(
        """INSERT INTO clinical_record (visit_id, chief_complaint_at_visit)
           VALUES ($1,$2)""",
        clinical_inserts,
    )
    return len(visit_rows), len(clinical_inserts)


async def _insert_labs(
    conn: asyncpg.Connection,
    labs: list[dict[str, str]],
    rc_ids: set[str],
) -> int:
    rows: list[tuple[Any, ...]] = []
    now = datetime.now()
    for r in labs:
        if r["clinic_patient_id"] in rc_ids:
            continue
        rows.append(
            (
                uuid.UUID(r["clinic_patient_id"]),
                (r.get("test_code") or "").strip() or "UNKNOWN",
                (r.get("test_name") or "").strip() or "UNKNOWN",
                _nn(r.get("panel_code")),
                _nn(r.get("result_value")),
                _nn(r.get("result_unit")),
                (r.get("triage_group") or "").strip() or "PENDING",
                _nn(r.get("lab_provider")),
                _nn(r.get("external_ref")),
                now,  # result_received_at — NOT NULL with no source
            )
        )
    await conn.executemany(
        """INSERT INTO lab_result (clinic_patient_id, test_code, test_name,
                panel_code, result_value, result_unit, triage_group,
                lab_provider, external_ref, result_received_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
        rows,
    )
    return len(rows)


# --------------------------------------------------------------------------- #
# Report                                                                      #
# --------------------------------------------------------------------------- #


def _render_report(
    result: TransformResult,
    inserted: dict[str, int],
    dry_run: bool,
) -> str:
    parts: list[str] = []
    parts.append("# Notion → Supabase sync report")
    parts.append(
        f"> Generated by ``scripts/data_import/sync_to_supabase.py`` "
        f"(``--dry-run``={dry_run})"
    )
    parts.append("")
    parts.append("## Transform counters")
    for table, counts in result.counters.items():
        parts.append(f"- **{table}**:")
        for k, v in counts.items():
            parts.append(f"  - {k}: {v}")
    parts.append("")
    parts.append("## Rows inserted into Supabase")
    if dry_run:
        parts.append(
            "*(dry-run: transaction was rolled back; "
            "counts are what *would* have landed)*"
        )
    for tbl, n in inserted.items():
        parts.append(f"- {tbl}: **{n}**")
    parts.append("")
    parts.append(
        f"## Review queue (manual adjudication needed): "
        f"{len(result.review_queue)} item(s)"
    )
    parts.append(f"## Rejects (no usable phone): {len(result.rejects)} row(s)")
    return "\n".join(parts) + "\n"


# --------------------------------------------------------------------------- #
# Main                                                                        #
# --------------------------------------------------------------------------- #


async def run(*, dry_run: bool, limit_per_source: int | None = None) -> int:
    load_dotenv()
    token = os.environ.get("NOTION_API_KEY")
    dsn = os.environ.get("DATABASE_URL")
    if not token or not dsn:
        raise SystemExit("NOTION_API_KEY or DATABASE_URL missing — check .env.")
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    notion = AsyncClient(auth=token)
    logger.info("pull_start")
    sources = await notion_to_sources(notion, limit_per_source=limit_per_source)
    counts = " ".join(f"{k}={len(v)}" for k, v in sources.items())
    logger.info("pull_done %s", counts)

    logger.info("transform_start")
    result = transform(sources)
    logger.info(
        "transform_done",
        extra={
            "patients": len(result.patients),
            "review_queue": len(result.review_queue),
        },
    )

    inserted: dict[str, int] = {}
    # Open the Supabase connection AFTER the (potentially multi-minute)
    # Notion pull so the pgbouncer pooler does not drop us during the
    # idle window. One retry on ``ConnectionDoesNotExistError`` covers the
    # case where pgbouncer recycles between ``connect()`` and ``BEGIN``.
    conn = await _connect_with_retry(dsn)
    try:
        # One transaction for the whole load — half-finished runs roll back.
        async with conn.transaction():
            master = await _resolve_master(conn)
            await _truncate_targets(conn)
            n_pat, rc_ids = await _insert_patients(conn, result, master["location_id"])
            inserted["patient"] = n_pat
            n_appt, skipped_appt = await _insert_appointments(
                conn, result.appointments, rc_ids, master
            )
            inserted["appointment"] = n_appt
            n_visit, n_clin = await _insert_visits_and_clinical(
                conn, result.clinical_records, rc_ids, master
            )
            inserted["visit"] = n_visit
            inserted["clinical_record"] = n_clin
            n_lab = await _insert_labs(conn, result.lab_results, rc_ids)
            inserted["lab_result"] = n_lab

            if dry_run:
                # Force rollback so a wet-run can verify before committing.
                raise _DryRunError
    except _DryRunError:
        logger.info("dry_run_complete_rolled_back")
    finally:
        await conn.close()

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(_render_report(result, inserted, dry_run), encoding="utf-8")
    print(
        f"\n{'DRY-RUN ' if dry_run else ''}Insert counts: "
        + ", ".join(f"{t}={n}" for t, n in inserted.items())
    )
    print(f"review_queue={len(result.review_queue)} rejects={len(result.rejects)}")
    print(f"Report → {REPORT_PATH.relative_to(REPO_ROOT)}")
    return 0


class _DryRunError(Exception):
    """Sentinel used to abort the transaction in dry-run mode."""


async def _connect_with_retry(dsn: str) -> asyncpg.Connection:
    """``asyncpg.connect`` + ``SELECT 1`` warmup, with one retry.

    The Supabase pgbouncer pooler tends to drop a connection if the
    process sat idle pulling Notion for a few minutes. The warmup query
    surfaces a dead connection immediately; one reconnect attempt covers
    the in-flight race between ``connect()`` and the first statement.
    """
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            conn = await asyncpg.connect(dsn)
            await conn.execute("SELECT 1")
            return conn
        except (
            asyncpg.exceptions.ConnectionDoesNotExistError,
            asyncpg.exceptions.ConnectionFailureError,
            ConnectionError,
        ) as exc:
            last_exc = exc
            logger.warning("db_connect_retry attempt=%d err=%s", attempt + 1, exc)
            await asyncio.sleep(1.0)
    raise RuntimeError(f"could not connect to Supabase: {last_exc}") from last_exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run the full transform + insert, then roll back the transaction.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Smoke-test cap — pull at most N rows per Notion source.",
    )
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    return asyncio.run(run(dry_run=args.dry_run, limit_per_source=args.limit))


if __name__ == "__main__":
    raise SystemExit(main())
