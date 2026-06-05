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
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import asyncpg
from dotenv import load_dotenv
from notion_client import AsyncClient

# Reuse the canon transform — same MPI rule, same join policy.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_import.csv_to_sources import csv_to_sources  # noqa: E402
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


# E2c — CSKH Action / Dịch vụ CSVs use Notion's English long-form export
# ("November 14, 2025 8:11 AM") + the Vietnamese "dd/mm/yyyy h:mm (GMT+7)"
# form. parse_datetime_vn handles the latter; this covers the former.
_EN_MONTH = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}
_EN_DT_RE = re.compile(
    r"@?\s*([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})"
    r"(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?",
    re.IGNORECASE,
)

# Notion exports timestamps in the workspace owner's TZ. PK is in
# Vietnam → GMT+7. Attach explicitly so the sync is deterministic
# regardless of the operator's machine TZ. (A Mac in Hanoi was
# accidentally producing correct UTC values via asyncpg's local-TZ
# fallback; a UTC CI box would have been 7 hours off.)
_PK_TZ = timezone(timedelta(hours=7))


def _parse_dt_loose(value: str | None) -> datetime | None:
    """Best-effort parser for Notion export timestamps.

    Tries: ISO 8601, then the Vietnamese ``dd/mm/yyyy h:mm (GMT+7)``
    via ``parse_datetime_vn`` (already tz-aware), then the canonical
    English ("Nov 14, 2025 8:11 AM" with optional leading "@" on
    Deadline cells), which we explicitly tag with GMT+7.

    Always returns a timezone-aware datetime when it returns anything —
    naive datetimes would be re-interpreted by asyncpg as the machine's
    local TZ, which is the bug this function exists to prevent.
    """
    v = _nn(value)
    if v is None:
        return None
    # ISO first. May or may not carry tzinfo — promote naive ISO to
    # +07:00 since the Notion-export semantic is workspace-local.
    try:
        dt = datetime.fromisoformat(v)
        return dt if dt.tzinfo else dt.replace(tzinfo=_PK_TZ)
    except ValueError:
        pass
    # Vietnamese dd/mm/yyyy via the canon transform helper.
    from data_migration.transform import parse_datetime_vn

    iso = parse_datetime_vn(v)
    if iso:
        try:
            dt = datetime.fromisoformat(iso)
            return dt if dt.tzinfo else dt.replace(tzinfo=_PK_TZ)
        except ValueError:
            pass
    # English long form — Notion's default for system fields like
    # "Created time" / "Last edited time" / "Deadline".
    m = _EN_DT_RE.search(v)
    if m:
        month_name, day, year, hour, minute, ampm = m.groups()
        month = _EN_MONTH.get(month_name.lower())
        if month is None:
            return None
        try:
            h = int(hour) if hour else 0
            mm = int(minute) if minute else 0
            if ampm and ampm.upper() == "PM" and h < 12:
                h += 12
            if ampm and ampm.upper() == "AM" and h == 12:
                h = 0
            return datetime(int(year), month, int(day), h, mm, tzinfo=_PK_TZ)
        except ValueError:
            return None
    return None


_INT_RE = re.compile(r"-?\d+")


def _parse_int(value: str | None) -> int | None:
    v = _nn(value)
    if v is None:
        return None
    m = _INT_RE.search(v)
    return int(m.group(0)) if m else None


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
    """Wipe the five demo-scope tables in dependency order via CASCADE.

    Note: TRUNCATE patient CASCADE *also* wipes patient_contact_channel
    (FK with ON DELETE CASCADE, migration 027). The sync re-populates
    that table in ``_backfill_patient_contact_channels`` below.
    """
    # Append-only guard (migration 033) blocks TRUNCATE on patient/appointment.
    # This is a controlled, single-transaction re-sync → opt out for THIS txn
    # only. SET LOCAL is scoped to the caller's open transaction (line ~876).
    await conn.execute("SET LOCAL app.allow_hard_delete = 'on'")
    # E2c — also wipe the 3 new child tables (cskh_action, service_log,
    # prescription). Order picked so CASCADE handles the dependents; the
    # explicit list also documents the demo-scope.
    await conn.execute(
        "TRUNCATE TABLE "
        "cskh_action, service_log, prescription, "
        "appointment, lab_result, clinical_record, visit, patient "
        "RESTART IDENTITY CASCADE"
    )


async def _backfill_patient_contact_channels(conn: asyncpg.Connection) -> int:
    """After patient INSERT, re-create one PHONE row per BN.

    Re-runs the logic of ``src/migrations/seed/007_backfill_patient_phone_contact.sql``
    inside the same transaction so a TRUNCATE-then-INSERT sync does not
    leave the contact_channel table empty until the operator remembers
    to re-apply the seed. Idempotent: the NOT EXISTS guards keep this
    safe even when contact_channel already has rows from a previous run.
    """
    await conn.execute(
        """INSERT INTO patient_contact_channel
              (clinic_patient_id, channel_type, channel_value,
               is_primary, is_verified)
           SELECT p.clinic_patient_id, 'PHONE', p.phone_primary, TRUE, FALSE
           FROM patient p
           WHERE p.phone_primary IS NOT NULL AND p.phone_primary <> ''
             AND NOT EXISTS (
                 SELECT 1 FROM patient_contact_channel pcc
                 WHERE pcc.clinic_patient_id = p.clinic_patient_id
                   AND pcc.channel_type = 'PHONE'
                   AND pcc.channel_value = p.phone_primary
             )"""
    )
    await conn.execute(
        """INSERT INTO patient_contact_channel
              (clinic_patient_id, channel_type, channel_value,
               is_primary, is_verified)
           SELECT p.clinic_patient_id, 'PHONE', p.phone_secondary, FALSE, FALSE
           FROM patient p
           WHERE p.phone_secondary IS NOT NULL AND p.phone_secondary <> ''
             AND NOT EXISTS (
                 SELECT 1 FROM patient_contact_channel pcc
                 WHERE pcc.clinic_patient_id = p.clinic_patient_id
                   AND pcc.channel_type = 'PHONE'
                   AND pcc.channel_value = p.phone_secondary
             )"""
    )
    return int(await conn.fetchval("SELECT count(*) FROM patient_contact_channel"))


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
    now = datetime.now()
    for p in result.patients:
        if p.merge_action == "REVIEW_CONFLICT":
            rc_ids.add(p.clinic_patient_id)
            continue
        seq += 1
        code = f"BN-{PATIENT_CODE_YEAR}-{seq:06d}"
        # Use the Notion "Created time" PK first saw the BN, not the
        # sync run's wall-clock.
        created = _parse_dt_loose(p.source_created_time) or now
        updated = _parse_dt_loose(p.source_updated_time) or created
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
                created,
                updated,
            )
        )
    await conn.executemany(
        """INSERT INTO patient (clinic_patient_id, patient_code, national_id_number,
                full_name, date_of_birth, phone_primary, phone_secondary,
                location_id, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
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
    location filters, just not on per-doctor views.

    Returns ``(inserted, skipped)`` where ``skipped`` counts ONLY rows that
    were NOT inserted — patient not loaded (MPI review-conflict) or no
    parseable ``slot_start`` (NOT NULL). Overlap conflicts are NOT skipped:
    the row IS inserted with ``doctor_id=NULL``, tracked separately and
    surfaced via the ``appointment_load_summary`` log line.
    """
    rows: list[tuple[Any, ...]] = []
    skipped_no_patient = 0  # patient in MPI review-conflict → not loaded
    skipped_no_slot = 0  # empty/unparseable "Ngày giờ hẹn" (slot_start NOT NULL)
    doctor_nulled = 0  # within-batch overlap → row KEPT, doctor_id NULL-ed
    # Track every accepted (start, end) per doctor; for each new
    # appointment, NULL its doctor_id when ANY accepted interval overlaps.
    # The exclusion constraint uses ``tstzrange [)``, so two appointments
    # overlap iff ``new.start < kept.end and new.end > kept.start``.
    doctor_intervals: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {}
    for r in appts:
        if r["clinic_patient_id"] in rc_ids:
            skipped_no_patient += 1
            continue
        slot_start = _parse_dt(r.get("slot_start"))
        if slot_start is None:
            skipped_no_slot += 1
            continue
        slot_end = slot_start + timedelta(minutes=DEFAULT_SLOT_MINUTES)
        status = _STATUS_MAP.get(r.get("status_raw", "").strip(), "SCHEDULED")
        doctor_id = _resolve_doctor(r.get("doctor_raw", ""), master)
        if doctor_id is not None:
            kept = doctor_intervals.setdefault(doctor_id, [])
            overlaps = any(slot_start < end and slot_end > start for start, end in kept)
            if overlaps:
                doctor_id = None
                doctor_nulled += 1  # row STILL inserted below; doctor dropped
            else:
                kept.append((slot_start, slot_end))
        created = _parse_dt_loose(r.get("source_created_time")) or slot_start
        updated = _parse_dt_loose(r.get("source_updated_time")) or created
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
                created,
                updated,
            )
        )
    await conn.executemany(
        """INSERT INTO appointment (clinic_patient_id, doctor_id, location_id,
                service_type_id, booking_channel, slot_start, slot_end, status,
                cancellation_reason, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
        rows,
    )
    skipped = skipped_no_patient + skipped_no_slot
    logger.info(
        "appointment_load_summary inserted=%d skipped_no_patient=%d "
        "skipped_no_slot=%d doctor_nulled_on_overlap=%d",
        len(rows),
        skipped_no_patient,
        skipped_no_slot,
        doctor_nulled,
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
    now = datetime.now()
    for r in clinical_rows:
        if r["clinic_patient_id"] in rc_ids:
            continue
        vid = uuid.uuid4()
        created = _parse_dt_loose(r.get("source_created_time")) or now
        updated = _parse_dt_loose(r.get("source_updated_time")) or created
        visit_rows.append(
            (
                vid,
                uuid.UUID(r["clinic_patient_id"]),
                master["location_id"],
                _resolve_service(r.get("service_type_raw", ""), master),
                "OPEN",
                created,
                updated,
            )
        )
        clinical_inserts.append((vid, _nn(r.get("chief_complaint")), created, updated))

    await conn.executemany(
        """INSERT INTO visit (visit_id, clinic_patient_id, location_id,
                service_type_id, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        visit_rows,
    )
    await conn.executemany(
        """INSERT INTO clinical_record (visit_id, chief_complaint_at_visit,
                created_at, updated_at)
           VALUES ($1,$2,$3,$4)""",
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
        # Use the Notion source timestamps so the dashboard shows when
        # PK actually ordered / received the test, not import day.
        created = _parse_dt_loose(r.get("source_created_time")) or now
        received = _parse_dt_loose(r.get("source_updated_time")) or created
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
                received,  # result_received_at
                created,  # created_at
                received,  # updated_at
            )
        )
    await conn.executemany(
        """INSERT INTO lab_result (clinic_patient_id, test_code, test_name,
                panel_code, result_value, result_unit, triage_group,
                lab_provider, external_ref, result_received_at,
                created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
        rows,
    )
    return len(rows)


# --------------------------------------------------------------------------- #
# E2c — extra-source loaders that bypass transform.py                         #
# (CSKH Action / Dịch vụ / Prescription)                                      #
# --------------------------------------------------------------------------- #


def _build_phone_index(result: TransformResult) -> dict[str, str]:
    """``phone → clinic_patient_id`` from the patients transform.py
    already deduped. Used to resolve link-text "Name SDT (URL)" cells in
    the CSKH Action / Dịch vụ CSVs.
    """
    return {
        norm_phone(p.phone_primary) or p.phone_primary: p.clinic_patient_id
        for p in result.patients
        if p.merge_action != "REVIEW_CONFLICT"
    }


def _resolve_patient_from_links(
    row: dict[str, str],
    link_fields: tuple[str, ...],
    phone_to_cpid: dict[str, str],
) -> str | None:
    """Mirror of transform.resolve_patient for the post-transform tables.

    Returns the staged clinic_patient_id when extract_phone hits a known
    BN; NULL otherwise so the parent row is kept but unlinked.
    """
    from data_migration.transform import extract_phone
    from data_migration.transform import norm_phone as _norm

    for field_name in link_fields:
        text = row.get(field_name) or ""
        phone = extract_phone(text)
        if phone is None:
            continue
        cpid = phone_to_cpid.get(_norm(phone) or phone)
        if cpid:
            return cpid
    return None


async def _insert_cskh_actions(
    conn: asyncpg.Connection,
    rows: list[dict[str, str]],
    phone_to_cpid: dict[str, str],
) -> int:
    """Load the ``CSKH Action`` CSV.

    Each row → 1 ``cskh_action`` record. ``clinic_patient_id`` resolved
    via the same extract_phone pattern transform.py uses; NULL when no
    known BN matches (row still kept for audit).
    """
    out: list[tuple[Any, ...]] = []
    now = datetime.now()
    seen_refs: set[str] = set()
    for r in rows:
        source_ref = (r.get("//ID") or r.get("Name") or "").strip()
        if not source_ref or source_ref in seen_refs:
            continue
        seen_refs.add(source_ref)
        cpid_str = _resolve_patient_from_links(
            r,
            (
                "🔑 File khách hàng (hành chính)",
                "//file lịch hẹn",
                "//file phiếu khám",
                "//file xét nghiệm",
            ),
            phone_to_cpid,
        )
        cpid = uuid.UUID(cpid_str) if cpid_str else None
        created = _parse_dt_loose(r.get("Giờ khởi tạo")) or now
        updated = _parse_dt_loose(r.get("Last edited time")) or created
        deadline = _parse_dt_loose(r.get("Deadline"))
        rating = _parse_int(r.get("Điểm đánh giá"))
        out.append(
            (
                source_ref,
                cpid,
                _nn(r.get("Phân loại")),
                _nn(r.get("Step")),
                _nn(r.get("Tình trạng")),
                _nn(r.get("Dữ liệu thao tác")),
                _nn(r.get("Mô tả chi tiết")),
                _nn(r.get("Kết quả thực hiện")),
                deadline,
                created,  # source_created_at
                updated,  # source_updated_at
                _nn(r.get("Created by")),
                _nn(r.get("Last edited by")),
                rating,
                _nn(r.get("Tag tính tiền")),
                _nn(r.get("//file lịch hẹn")),
                _nn(r.get("//file phiếu khám")),
                _nn(r.get("//file xét nghiệm")),
                _nn(r.get("🔑 File khách hàng (hành chính)")),
                created,  # created_at = source_created_at
                updated,  # updated_at
            )
        )
    await conn.executemany(
        """INSERT INTO cskh_action (source_ref, clinic_patient_id, category,
                step, status, action_data, description, result_text,
                deadline_at, source_created_at, source_updated_at,
                created_by_text, last_edited_by_text, rating, billing_tag,
                appointment_link_raw, visit_link_raw, lab_link_raw,
                patient_link_raw, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                   $16,$17,$18,$19,$20,$21)""",
        out,
    )
    return len(out)


async def _insert_services(
    conn: asyncpg.Connection,
    rows: list[dict[str, str]],
    phone_to_cpid: dict[str, str],
    master: dict[str, Any],
) -> int:
    """Load the ``Dịch vụ`` CSV → ``service_log``."""
    out: list[tuple[Any, ...]] = []
    now = datetime.now()
    seen_refs: set[str] = set()
    for r in rows:
        source_ref = (r.get("ID") or r.get("Name") or "").strip()
        if not source_ref or source_ref in seen_refs:
            continue
        seen_refs.add(source_ref)
        cpid_str = _resolve_patient_from_links(
            r,
            ("CSDL bệnh nhân (lâm sàng)", "Phiếu khám"),
            phone_to_cpid,
        )
        cpid = uuid.UUID(cpid_str) if cpid_str else None
        service_name = (r.get("Tên dịch vụ") or "").strip()
        # Best-effort service_type FK: text starts with the friendly name
        # (e.g. "[TT] Soi buồng tử cung chuẩn đoán (https://...)"). Strip
        # the URL and any bracketed prefix before lookup.
        sname = service_name.split("(http")[0].strip()
        for prefix in ("[TT]", "[SA]", "[KHAM]", "[XN]"):
            if sname.startswith(prefix):
                sname = sname[len(prefix) :].strip()
                break
        sid = master["service_by_name"].get(sname.lower())
        ordered = _parse_dt_loose(r.get("Giờ chỉ định")) or now
        started = _parse_dt_loose(r.get("//Giờ bắt đầu"))
        finished = _parse_dt_loose(r.get("//Giờ kết thúc"))
        out.append(
            (
                source_ref,
                cpid,
                sid,
                service_name or None,
                _nn(r.get("//Người làm")),
                _nn(r.get("Tình trạng")),
                _nn(r.get("Kết quả")),
                ordered,
                started,
                finished,
                _nn(r.get("//created by")),
                _nn(r.get("Phiếu khám")),
                _nn(r.get("CSDL bệnh nhân (lâm sàng)")),
                _nn(r.get("📝 Tờ in kết quả")),
                ordered,
                ordered,
            )
        )
    await conn.executemany(
        """INSERT INTO service_log (source_ref, clinic_patient_id,
                service_type_id, service_name_raw, performer_text, status,
                result_text, ordered_at, started_at, finished_at,
                created_by_text, visit_link_raw, patient_link_raw,
                result_form_url, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)""",
        out,
    )
    return len(out)


async def _insert_prescriptions(
    conn: asyncpg.Connection,
    rxs: list[dict[str, str]],
    rc_ids: set[str],
) -> int:
    """Load transform.py's staged prescription dicts now that the target
    table exists (migration 031)."""
    out: list[tuple[Any, ...]] = []
    now = datetime.now()
    for r in rxs:
        if r["clinic_patient_id"] in rc_ids:
            continue
        source_ref = (r.get("source_ref") or "").strip()
        if not source_ref:
            continue
        cpid = uuid.UUID(r["clinic_patient_id"])
        created = _parse_dt_loose(r.get("source_created_time")) or now
        updated = _parse_dt_loose(r.get("source_updated_time")) or created
        out.append(
            (
                source_ref,
                cpid,
                None,  # visit_id resolved Phase 2 (need URL→visit map)
                _nn(r.get("drug_name")),
                _nn(r.get("drug_catalog_ref")),
                _nn(r.get("dosage_instructions")),
                _nn(r.get("quantity")),
                _nn(r.get("quantity_note")),
                _nn(r.get("note")),  # caution
                _nn(r.get("standardized_form")),
                _nn(r.get("exam_raw")),
                created,
                updated,
            )
        )
    await conn.executemany(
        """INSERT INTO prescription (source_ref, clinic_patient_id, visit_id,
                drug_name_raw, drug_catalog_ref, dosage_instructions,
                quantity, quantity_note, caution, standardized_form,
                visit_link_raw, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (source_ref) DO NOTHING""",
        out,
    )
    return len(out)


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


async def run(
    *,
    dry_run: bool,
    source: str = "csv",
    limit_per_source: int | None = None,
    csv_dir: Path | None = None,
) -> int:
    """``source`` = ``'csv'`` (default — recovers lab + relations from the
    PK export) or ``'notion'`` (the cloned workspace — relations are
    broken there because Notion strips cross-DB UUIDs on duplicate)."""
    load_dotenv()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL missing — check .env.")
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    if source == "csv":
        logger.info("pull_start source=csv csv_dir=%s", csv_dir)
        sources = csv_to_sources(csv_root=csv_dir, limit_per_source=limit_per_source)
    elif source == "notion":
        token = os.environ.get("NOTION_API_KEY")
        if not token:
            raise SystemExit("NOTION_API_KEY missing — required when --source notion.")
        notion = AsyncClient(auth=token)
        logger.info("pull_start source=notion")
        sources = await notion_to_sources(notion, limit_per_source=limit_per_source)
    else:
        raise SystemExit(f"unknown --source {source!r}; expected csv|notion")

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
            # #15 — minh bạch khối lượng DROP do REVIEW_CONFLICT (cùng SĐT khác tên).
            # Chính sách an toàn: KHÔNG load để tránh gộp nhầm hồ sơ 2 người; nhưng
            # operator PHẢI thấy bao nhiêu con bị bỏ theo BN gốc (trước đây im lặng).
            if rc_ids:
                drop_appt = sum(
                    1 for r in result.appointments if r["clinic_patient_id"] in rc_ids
                )
                drop_clin = sum(
                    1
                    for r in result.clinical_records
                    if r["clinic_patient_id"] in rc_ids
                )
                drop_lab = sum(
                    1 for r in result.lab_results if r["clinic_patient_id"] in rc_ids
                )
                drop_rx = sum(
                    1 for r in result.prescriptions if r["clinic_patient_id"] in rc_ids
                )
                logger.warning(
                    "REVIEW_CONFLICT: %d BN giữ lại review (cùng SĐT khác tên) → "
                    "KHÔNG load %d lịch hẹn, %d visit/hồ sơ khám, %d KQ xét nghiệm, "
                    "%d đơn thuốc. Rà tay rồi nạp bổ sung nếu cần.",
                    len(rc_ids),
                    drop_appt,
                    drop_clin,
                    drop_lab,
                    drop_rx,
                )
            # skipped count is surfaced via the appointment_load_summary log
            # line inside _insert_appointments; not needed here.
            n_appt, _ = await _insert_appointments(
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

            # E2c — Rx / CSKH / Dịch vụ. These bypass transform.py and
            # do a second extract_phone pass against ``phone_to_cpid`` to
            # resolve the parent BN. Raw rows survive ``sources`` because
            # csv_to_sources.py loads the 7 datasets and transform.py
            # only consumes 5.
            n_rx = await _insert_prescriptions(conn, result.prescriptions, rc_ids)
            inserted["prescription"] = n_rx
            phone_to_cpid = _build_phone_index(result)
            n_cskh = await _insert_cskh_actions(
                conn, sources.get("cskh_action", []), phone_to_cpid
            )
            inserted["cskh_action"] = n_cskh
            n_svc = await _insert_services(
                conn,
                sources.get("service", []),
                phone_to_cpid,
                master,
            )
            inserted["service_log"] = n_svc

            # Re-populate contact_channel — CASCADE from the TRUNCATE
            # above wiped the rows; we want one PHONE record per BN.
            n_contact = await _backfill_patient_contact_channels(conn)
            inserted["patient_contact_channel"] = n_contact

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
        help="Smoke-test cap — load at most N rows per source.",
    )
    parser.add_argument(
        "--source",
        choices=("csv", "notion"),
        default="csv",
        help=(
            "Where to pull rows from. 'csv' (default) reads the PK-exported "
            "bundle (relations populated as text → recovers lab_result + "
            "appointment + clinical). 'notion' reads the cloned workspace "
            "(relations stripped on duplicate)."
        ),
    )
    parser.add_argument(
        "--csv-dir",
        type=Path,
        default=None,
        help=(
            "Override the CSV bundle path (default: ../Data khách gửi). "
            "Only used when --source csv."
        ),
    )
    args = parser.parse_args()

    # CHỐT CHẶN (04/06): MVP đã chuyển sang NHẬP TAY. Sync THẬT sẽ TRUNCATE rồi
    # nạp lại data import (Notion/CSV) → XOÁ sạch data phòng khám nhập tay. Chỉ
    # cho chạy sync ghi-DB khi operator CHỦ ĐỘNG đặt CLINIC_ALLOW_NOTION_SYNC=1.
    # --dry-run vô hại (rollback) nên được miễn.
    if not args.dry_run and os.environ.get("CLINIC_ALLOW_NOTION_SYNC") != "1":
        print(
            "REFUSED: sync THẬT sẽ TRUNCATE rồi nạp lại data import — XOÁ data "
            "nhập tay trên dashboard.\n"
            "Nếu CHẮC CHẮN muốn nạp lại bộ data demo, đặt biến môi trường "
            "CLINIC_ALLOW_NOTION_SYNC=1 rồi chạy lại.\n"
            "(Hoặc dùng --dry-run để thử transform mà KHÔNG ghi DB.)",
            file=sys.stderr,
        )
        return 2

    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    return asyncio.run(
        run(
            dry_run=args.dry_run,
            source=args.source,
            limit_per_source=args.limit,
            csv_dir=args.csv_dir,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
