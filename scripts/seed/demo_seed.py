"""Seed 30 demo patients via patient_service (Task B).

Step 2/3 of the demo seed pipeline. Reads ``scripts/seed/seed_sample.json``
(produced by Task A) and inserts each record via
``PatientService.create_patient`` so the normal MPI / event_log /
Realtime side-effects fire — patients show up live in the dashboard.

This script does NOT touch the database via raw SQL (except for the
read-only location lookup, the patient counter, and the safe ``--wipe``
DELETE that is scoped to seed phones). All patient rows are created
through the service layer.

USAGE
-----
    poetry run python scripts/seed/demo_seed.py --location-name "Kim Ngưu"

    # Wipe seeded patients (matched by phone_primary IN <seed phones>):
    poetry run python scripts/seed/demo_seed.py --wipe --yes

The ``--wipe`` flag deletes ONLY patient rows whose phone_primary appears
in seed_sample.json. It never issues an unscoped DELETE.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from uuid import UUID

import asyncpg
from dotenv import load_dotenv

from clinicai.schemas.patient import PatientCreateDTO
from clinicai.services.patient_service import PatientService

logger = logging.getLogger("seed.demo_seed")

DEFAULT_INPUT = Path("scripts/seed/seed_sample.json")


# --------------------------------------------------------------------------- #
# Counters
# --------------------------------------------------------------------------- #


@dataclass
class SeedCounters:
    created_new: int = 0
    mpi_matched: int = 0  # Reserved — service never returns existing today.
    mpi_queue_added: int = 0  # MPI sidecar appended candidates to merge queue.
    error: int = 0
    errors_by_reason: dict[str, int] | None = None

    def __post_init__(self) -> None:
        if self.errors_by_reason is None:
            self.errors_by_reason = {}

    def add_error(self, reason: str) -> None:
        self.error += 1
        assert self.errors_by_reason is not None
        self.errors_by_reason[reason] = self.errors_by_reason.get(reason, 0) + 1


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _get_dsn() -> str:
    load_dotenv()
    raw = os.getenv("DATABASE_URL")
    if not raw:
        raise RuntimeError("DATABASE_URL not set; cannot connect to Supabase.")
    return raw.replace("postgresql+asyncpg://", "postgresql://", 1)


def _parse_dob(value: Any) -> date | None:
    if value is None or value == "":
        return None
    return date.fromisoformat(str(value))


def _record_to_dto(record: dict[str, Any], location_id: UUID) -> PatientCreateDTO:
    return PatientCreateDTO(
        full_name=record["full_name"],
        date_of_birth=_parse_dob(record.get("date_of_birth")),
        phone_primary=record.get("phone_primary"),
        phone_secondary=None,
        national_id_number=None,
        location_id=location_id,
        is_active=True,
    )


async def _resolve_location(pool: asyncpg.Pool, location_name: str | None) -> UUID:
    """Resolve clinic_location → UUID per packet rules.

    - 1 row total: use it.
    - >1 row: require --location-name, match by `name`. Else print list and exit.
    - 0 row: refuse to proceed (caller must seed clinic_location first).
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, code, name, is_active FROM clinic_location ORDER BY name"
        )

    if not rows:
        print("ERROR: clinic_location is empty. Seed master data first.")
        sys.exit(2)

    if len(rows) == 1:
        row = rows[0]
        print(f"Resolved single location: {row['code']} | {row['name']}")
        return UUID(str(row["id"]))

    if not location_name:
        print(
            f"ERROR: clinic_location has {len(rows)} rows — "
            "pass --location-name to disambiguate."
        )
        print("Available locations:")
        for r in rows:
            active = "active" if r["is_active"] else "inactive"
            print(f"  - {r['code']} | {r['name']} | {active}")
        sys.exit(2)

    target = location_name.strip().lower()
    matches = [r for r in rows if r["name"].strip().lower() == target]
    if not matches:
        print(f"ERROR: no clinic_location matches --location-name {location_name!r}.")
        print("Available names: " + ", ".join(repr(r["name"]) for r in rows))
        sys.exit(2)
    if len(matches) > 1:
        print(
            f"ERROR: multiple locations match {location_name!r}; name must be unique."
        )
        sys.exit(2)

    resolved = matches[0]
    print(f"Resolved location: {resolved['code']} | {resolved['name']}")
    return UUID(str(resolved["id"]))


async def _count_mpi_for(pool: asyncpg.Pool, clinic_patient_id: UUID) -> int:
    """How many merge-queue entries does this freshly-created patient have?

    Sidecar metric — surfaces the case where the seed batch contained
    natural duplicates (same phone / same name+DOB).
    """
    query = (
        "SELECT COUNT(*) FROM mpi_merge_queue "
        "WHERE patient_id_a = $1 OR patient_id_b = $1"
    )
    async with pool.acquire() as conn:
        return int(await conn.fetchval(query, clinic_patient_id))


# --------------------------------------------------------------------------- #
# Wipe
# --------------------------------------------------------------------------- #


async def _wipe_seeds(
    pool: asyncpg.Pool,
    seed_records: list[dict[str, Any]],
    auto_yes: bool,
) -> int:
    """Delete patients whose phone_primary appears in seed_sample.json.

    Refuses to issue an unscoped DELETE. Asks for confirmation unless --yes.
    Returns the row count actually deleted.
    """
    phones = sorted(
        {r["phone_primary"] for r in seed_records if r.get("phone_primary")}
    )
    if not phones:
        print("--wipe: seed file has no phone_primary values; nothing to do.")
        return 0

    count_query = "SELECT COUNT(*) FROM patient WHERE phone_primary = ANY($1::text[])"
    async with pool.acquire() as conn:
        existing = int(await conn.fetchval(count_query, phones))

    print(f"--wipe: {existing} patient row(s) match {len(phones)} seed phones.")
    if existing == 0:
        return 0

    if not auto_yes:
        answer = input("Confirm DELETE these rows? Type 'yes' to proceed: ").strip()
        if answer.lower() != "yes":
            print("Aborted — no rows deleted.")
            return 0

    delete_query = (
        "DELETE FROM patient WHERE phone_primary = ANY($1::text[]) RETURNING 1"
    )
    async with pool.acquire() as conn:
        # Append-only guard (migration 033) blocks ad-hoc DELETE on patient.
        # This is a scoped, confirmed seed wipe → opt out for this txn only.
        async with conn.transaction():
            await conn.execute("SET LOCAL app.allow_hard_delete = 'on'")
            deleted_rows = await conn.fetch(delete_query, phones)
    deleted = len(deleted_rows)
    print(f"--wipe: deleted {deleted} row(s).")
    return deleted


# --------------------------------------------------------------------------- #
# Seed
# --------------------------------------------------------------------------- #


async def _seed(
    pool: asyncpg.Pool,
    records: list[dict[str, Any]],
    location_id: UUID,
) -> SeedCounters:
    service = PatientService(pool)
    counters = SeedCounters()

    for idx, record in enumerate(records, start=1):
        try:
            dto = _record_to_dto(record, location_id)
        except Exception as exc:  # noqa: BLE001
            counters.add_error(f"dto_build: {type(exc).__name__}")
            print(f"[{idx:02d}] ERROR build DTO: {exc}")
            continue

        try:
            created = await service.create_patient(dto)
        except Exception as exc:  # noqa: BLE001 — surface anything as a count.
            counters.add_error(f"create_patient: {type(exc).__name__}")
            print(f"[{idx:02d}] ERROR create_patient: {exc}")
            continue

        counters.created_new += 1
        # Inspect MPI side-effect for observability (record may sit in merge queue).
        mpi_entries = await _count_mpi_for(pool, created.clinic_patient_id)
        if mpi_entries > 0:
            counters.mpi_queue_added += 1

        print(
            f"[{idx:02d}] OK  patient_code={created.patient_code} "
            f"clinic_patient_id={created.clinic_patient_id} "
            f"mpi_queue={mpi_entries}"
        )

    return counters


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #


def _load_records(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"seed file not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"seed file must be a JSON list, got {type(data).__name__}")
    return data


async def _async_main(args: argparse.Namespace) -> int:
    records = _load_records(args.input)
    dsn = _get_dsn()
    pool = await asyncpg.create_pool(dsn)
    try:
        if args.wipe:
            await _wipe_seeds(pool, records, auto_yes=args.yes)
            return 0

        location_id = await _resolve_location(pool, args.location_name)
        counters = await _seed(pool, records, location_id)

        print()
        print("=== Demo seed summary ===")
        print(f"Input file       : {args.input}")
        print(f"Records in file  : {len(records)}")
        print(f"created_new      : {counters.created_new}")
        print(
            f"mpi_matched      : {counters.mpi_matched}  "
            "(service never returns existing)"
        )
        print(
            f"mpi_queue_added  : {counters.mpi_queue_added}  "
            "(sidecar — natural duplicates)"
        )
        print(f"error            : {counters.error}")
        if counters.errors_by_reason:
            for reason, n in sorted(counters.errors_by_reason.items()):
                print(f"  - {reason}: {n}")
        print("=========================")
    finally:
        await pool.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Seed JSON path (default: {DEFAULT_INPUT}).",
    )
    parser.add_argument(
        "--location-name",
        type=str,
        default=None,
        help="Name of clinic_location to attach patients to (required if >1 row).",
    )
    parser.add_argument(
        "--wipe",
        action="store_true",
        help="Delete patient rows whose phone_primary is in seed_sample.json.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the interactive confirmation prompt for --wipe.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(_async_main(args))


if __name__ == "__main__":
    sys.exit(main())
