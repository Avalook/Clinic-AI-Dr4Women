"""Tests for schema migrations 008-011 and constraints."""

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
async def test_apply_runs_all_p4_migrations(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that applying migrations runs 008, 009, 010, and 011 SQLs."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 11
    assert "20260520_008_create_staff.sql" in applied
    assert "20260520_009_create_work_session.sql" in applied
    assert "20260520_010_create_work_session_staff.sql" in applied
    assert "20260520_011_create_appointment.sql" in applied

    # Verify that tracking table recordings are set
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_008_create_staff.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_009_create_work_session.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_010_create_work_session_staff.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_011_create_appointment.sql",
    )


@pytest.mark.asyncio
async def test_rollback_drops_in_reverse_fk_order(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that rollbacks occur in reverse dependency order."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # 1. Rollback Appointment (011) first
    conn.fetchrow.return_value = {"filename": "20260520_011_create_appointment.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_011_create_appointment.sql"

    # 2. Rollback Work Session Staff (010) second
    conn.fetchrow.return_value = {
        "filename": "20260520_010_create_work_session_staff.sql"
    }
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_010_create_work_session_staff.sql"

    # 3. Rollback Work Session (009) third
    conn.fetchrow.return_value = {"filename": "20260520_009_create_work_session.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_009_create_work_session.sql"

    # 4. Rollback Staff Alter (008) fourth
    conn.fetchrow.return_value = {"filename": "20260520_008_create_staff.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_008_create_staff.sql"


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
    schema_name = "test_migrations_temp"
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
async def test_work_session_unique_constraint(temp_schema_db) -> None:
    """Verify Unique constraint on work_session."""
    conn = temp_schema_db

    # Insert a clinic location first (to satisfy REFERENCES)
    loc_id = await conn.fetchval(
        "INSERT INTO clinic_location (code, name) VALUES ('L1', 'Loc 1') RETURNING id;"
    )

    # Insert first work_session
    await conn.execute(
        """
        INSERT INTO work_session (
            location_id, session_date, session_type, start_time, end_time
        )
        VALUES ($1, '2026-06-01', 'EVENING', '18:00:00', '21:00:00');
        """,
        loc_id,
    )

    # Insert duplicate work_session (should raise UniqueViolationError)
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        await conn.execute(
            """
            INSERT INTO work_session (
                location_id, session_date, session_type, start_time, end_time
            )
            VALUES ($1, '2026-06-01', 'EVENING', '18:00:00', '21:00:00');
            """,
            loc_id,
        )


@pytest.mark.asyncio
async def test_appointment_status_check_constraint(temp_schema_db) -> None:
    """Insert invalid status to verify status CHECK constraint on appointment."""
    conn = temp_schema_db

    loc_id = await conn.fetchval(
        "INSERT INTO clinic_location (code, name) VALUES ('L1', 'Loc 1') RETURNING id;"
    )
    patient_id = await conn.fetchval(
        """
        INSERT INTO patient (patient_code, full_name, location_id)
        VALUES ('PAT-1', 'Patient A', $1) RETURNING clinic_patient_id;
        """,
        loc_id,
    )
    service_id = await conn.fetchval(
        "INSERT INTO service_type (code, name) VALUES ('S1', 'Service 1') RETURNING id;"
    )

    # Try inserting invalid status (INVALID_STATUS) -> should fail check constraint
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        await conn.execute(
            """
            INSERT INTO appointment (
                clinic_patient_id, location_id, service_type_id,
                slot_start, slot_end, status
            )
            VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 hour', 'INVALID_STATUS');
            """,
            patient_id,
            loc_id,
            service_id,
        )


@pytest.mark.asyncio
async def test_appointment_slot_end_after_start_check(temp_schema_db) -> None:
    """Insert end_time <= start_time to verify CHECK constraint on appointment slots."""
    conn = temp_schema_db

    loc_id = await conn.fetchval(
        "INSERT INTO clinic_location (code, name) VALUES ('L1', 'Loc 1') RETURNING id;"
    )
    patient_id = await conn.fetchval(
        """
        INSERT INTO patient (patient_code, full_name, location_id)
        VALUES ('PAT-2', 'Patient B', $1) RETURNING clinic_patient_id;
        """,
        loc_id,
    )
    service_id = await conn.fetchval(
        "INSERT INTO service_type (code, name) VALUES ('S1', 'Service 1') RETURNING id;"
    )

    # Try inserting slot_end <= slot_start (end_time is 1 hour before start_time)
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        await conn.execute(
            """
            INSERT INTO appointment (
                clinic_patient_id, location_id, service_type_id,
                slot_start, slot_end
            )
            VALUES ($1, $2, $3, NOW(), NOW() - INTERVAL '1 hour');
            """,
            patient_id,
            loc_id,
            service_id,
        )


@pytest.mark.asyncio
async def test_wss_station_text_field(temp_schema_db) -> None:
    """Verify work_session_staff accepts free text for station."""
    conn = temp_schema_db

    loc_id = await conn.fetchval(
        "INSERT INTO clinic_location (code, name) VALUES ('L1', 'Loc 1') RETURNING id;"
    )
    staff_id = await conn.fetchval(
        """
        INSERT INTO staff (full_name, primary_department, primary_location_id)
        VALUES ('Dr. Staff', 'DOCTOR', $1) RETURNING id;
        """,
        loc_id,
    )
    ws_id = await conn.fetchval(
        """
        INSERT INTO work_session (
            location_id, session_date, session_type, start_time, end_time
        )
        VALUES ($1, '2026-06-01', 'EVENING', '18:00:00', '21:00:00') RETURNING id;
        """,
        loc_id,
    )

    # Insert a custom station name (free text string) -> should succeed
    await conn.execute(
        """
        INSERT INTO work_session_staff (work_session_id, staff_id, role, station)
        VALUES ($1, $2, 'DOCTOR', 'Station-X-Special-Name');
        """,
        ws_id,
        staff_id,
    )


@pytest.mark.asyncio
async def test_staff_seed_inserts_correct_count(temp_schema_db) -> None:
    """Verify that staff seed runs correctly and is idempotent."""
    conn = temp_schema_db

    # 1. Execute clinic location seed
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    loc_seed_file = migrations_dir / "seed" / "001_clinic_location.sql"
    loc_sql = loc_seed_file.read_text(encoding="utf-8")
    loc_sql_cleaned = re.sub(r"^\s*BEGIN\s*;\s*", "", loc_sql, flags=re.IGNORECASE)
    loc_sql_cleaned = re.sub(
        r"\s*COMMIT\s*;\s*$", "", loc_sql_cleaned, flags=re.IGNORECASE
    )
    await conn.execute(loc_sql_cleaned)

    # 2. Run staff seed first time
    staff_seed_file = migrations_dir / "seed" / "004_staff.sql"
    staff_sql = staff_seed_file.read_text(encoding="utf-8")
    await conn.execute(staff_sql)

    # 3. Assert counts
    active_count = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE is_active = TRUE;"
    )
    inactive_dao_count = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE is_active = FALSE AND full_name LIKE '%Đào%';"
    )
    doctor_count = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE primary_department = 'DOCTOR';"
    )

    assert active_count == 28
    assert inactive_dao_count == 1
    assert doctor_count == 8

    # 4. Idempotency check: Run seed a second time and check counts remain identical
    await conn.execute(staff_sql)

    active_count_2 = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE is_active = TRUE;"
    )
    inactive_dao_count_2 = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE is_active = FALSE AND full_name LIKE '%Đào%';"
    )
    doctor_count_2 = await conn.fetchval(
        "SELECT count(*) FROM staff WHERE primary_department = 'DOCTOR';"
    )

    assert active_count_2 == 28
    assert inactive_dao_count_2 == 1
    assert doctor_count_2 == 8
