"""Tests for schema migration 012 (appointment slot exclusion) and constraints."""

import os
import pathlib
import re
from unittest.mock import AsyncMock, MagicMock

import asyncpg
import pytest
from dotenv import load_dotenv

from clinicai.migrations.runner import MigrationRunner

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


@pytest.fixture
def mock_db() -> tuple[MagicMock, AsyncMock]:
    """Fixture that returns a mocked asyncpg Pool and Connection."""
    pool = MagicMock()
    conn = AsyncMock()
    conn.transaction = MagicMock()

    # Configure pool.acquire() to return the connection async context manager
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__.return_value = conn
    pool.acquire.return_value = acquire_ctx

    # Configure conn.transaction() to return an async context manager
    transaction_ctx = AsyncMock()
    conn.transaction.return_value = transaction_ctx

    return pool, conn


@pytest.mark.asyncio
async def test_apply_runs_012_migration(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that applying migrations runs 012 SQL."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 12
    assert "20260520_012_appointment_slot_exclusion.sql" in applied

    # Verify that tracking table recording is set
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_012_appointment_slot_exclusion.sql",
    )


@pytest.mark.asyncio
async def test_rollback_012(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that rolling back returns 012 down migration."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # Rollback Appointment Exclusion (012)
    conn.fetchrow.return_value = {
        "filename": "20260520_012_appointment_slot_exclusion.sql"
    }
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_012_appointment_slot_exclusion.sql"


# --- Real database constraint tests inside transient schemas ---


async def run_all_migrations_in_tx(conn) -> None:
    """Helper to run up migrations in order in the active transaction."""
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"), key=lambda p: p.name)
    up_files = [
        f
        for f in sql_files
        if not f.name.endswith(".down.sql") and f.name.startswith("2026")
    ]

    for f in up_files:
        content = f.read_text(encoding="utf-8")
        # Strip transaction boundary statements
        cleaned = re.sub(r"^\s*BEGIN\s*;\s*", "", content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*COMMIT\s*;\s*$", "", cleaned, flags=re.IGNORECASE)
        await conn.execute(cleaned)


@pytest.fixture
async def temp_schema_db():
    """Yields a connection set up to run tests inside a transient schema."""
    if not DATABASE_URL:
        pytest.skip("no DB")

    dsn = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(dsn)

    # Set up temporary schema and search path
    schema_name = "test_migrations_012_temp"
    await conn.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name};")
    await conn.execute(f"SET search_path TO {schema_name};")

    tx = conn.transaction()
    await tx.start()

    try:
        await run_all_migrations_in_tx(conn)
        yield conn
    finally:
        await tx.rollback()
        await conn.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
        await conn.close()


@pytest.mark.asyncio
async def test_appointment_exclusion_constraint(temp_schema_db) -> None:
    """Verify Exclusion constraint on appointment prevents double-booking."""
    conn = temp_schema_db

    # 1. Insert clinic location
    loc_id = await conn.fetchval(
        "INSERT INTO clinic_location (code, name) VALUES ('L1', 'Loc 1') RETURNING id;"
    )

    # 2. Insert patient
    patient_id = await conn.fetchval(
        """
        INSERT INTO patient (
            patient_code, full_name, date_of_birth, phone_primary, location_id
        )
        VALUES ('PAT-TEST-12', 'Patient A', '1990-01-01', '0901234567', $1)
        RETURNING clinic_patient_id;
        """,
        loc_id,
    )

    # 3. Insert doctor (staff)
    doctor_id = await conn.fetchval(
        """
        INSERT INTO staff (full_name, primary_department, primary_location_id)
        VALUES ('BS Alice', 'DOCTOR', $1) RETURNING id;
        """,
        loc_id,
    )

    # 4. Insert service type
    service_type_id = await conn.fetchval(
        "INSERT INTO service_type (code, name) "
        "VALUES ('SVC1', 'Service 1') RETURNING id;"
    )

    # 5. Insert first appointment
    await conn.execute(
        """
        INSERT INTO appointment (
            clinic_patient_id, doctor_id, location_id, service_type_id,
            slot_start, slot_end, status
        )
        VALUES (
            $1, $2, $3, $4, '2026-06-01 10:00:00Z', '2026-06-01 10:30:00Z',
            'SCHEDULED'
        );
        """,
        patient_id,
        doctor_id,
        loc_id,
        service_type_id,
    )

    # 6. Insert second overlapping appointment for the same doctor (should fail)
    with pytest.raises(asyncpg.exceptions.ExclusionViolationError):
        await conn.execute(
            """
            INSERT INTO appointment (
                clinic_patient_id, doctor_id, location_id, service_type_id,
                slot_start, slot_end, status
            )
            VALUES (
                $1, $2, $3, $4, '2026-06-01 10:15:00Z', '2026-06-01 10:45:00Z',
                'SCHEDULED'
            );
            """,
            patient_id,
            doctor_id,
            loc_id,
            service_type_id,
        )
