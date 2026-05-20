"""Tests for the master data schema migrations 001-003 and seeds."""

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner


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
async def test_apply_master_migrations(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    """Test that applying migrations runs all three master data SQL scripts."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    # Point to the actual migrations directory in the project
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 3
    assert "20260520_001_create_clinic_location.sql" in applied
    assert "20260520_002_create_service_type.sql" in applied
    assert "20260520_003_create_staff.sql" in applied

    # Verify that the table schema queries were executed
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]

    assert any(
        "CREATE TABLE IF NOT EXISTS clinic_location" in stmt
        for stmt in executed_statements
    )
    assert any(
        "CREATE TABLE IF NOT EXISTS service_type" in stmt
        for stmt in executed_statements
    )
    assert any(
        "CREATE TABLE IF NOT EXISTS staff" in stmt for stmt in executed_statements
    )

    # Verify tracking table recording
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_001_create_clinic_location.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_002_create_service_type.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_003_create_staff.sql",
    )


@pytest.mark.asyncio
async def test_rollback_master_migrations(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    """Test that master migrations rollback drops tables in reverse order."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # 1. Rollback Staff (003)
    conn.fetchrow.return_value = {"filename": "20260520_003_create_staff.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_003_create_staff.sql"

    # 2. Rollback Service Type (002)
    conn.fetchrow.return_value = {"filename": "20260520_002_create_service_type.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_002_create_service_type.sql"

    # 3. Rollback Clinic Location (001)
    conn.fetchrow.return_value = {"filename": "20260520_001_create_clinic_location.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_001_create_clinic_location.sql"

    # Verify executing DROP statements in the connection calls
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]
    assert any("DROP TABLE IF EXISTS staff" in stmt for stmt in executed_statements)
    assert any(
        "DROP TABLE IF EXISTS service_type" in stmt for stmt in executed_statements
    )
    assert any(
        "DROP TABLE IF EXISTS clinic_location" in stmt for stmt in executed_statements
    )


@pytest.mark.asyncio
async def test_clinic_location_seed_file() -> None:
    """Test that seed/001_clinic_location.sql has valid structures and entries."""
    migrations_path = pathlib.Path(__file__).parent.parent / "migrations"
    seed_file = migrations_path / "seed" / "001_clinic_location.sql"
    assert seed_file.is_file()

    sql_content = seed_file.read_text(encoding="utf-8")

    # Verify BEGIN, COMMIT, ON CONFLICT and specified seeds are in the file
    assert "BEGIN;" in sql_content
    assert "COMMIT;" in sql_content
    assert "clinic_location" in sql_content
    assert "ON CONFLICT (code) DO NOTHING;" in sql_content

    # Verify Kim Nguu and Hao Nam seed rows exist
    assert "'KN'" in sql_content
    assert "'Kim Ngưu'" in sql_content
    assert "'HN'" in sql_content
    assert "'Hào Nam'" in sql_content
    assert "TRUE" in sql_content
    assert "FALSE" in sql_content
