"""Tests for the patient identity and MPI merge queue migrations 004-005."""

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
async def test_apply_patient_migrations(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    """Test that applying migrations runs patient and mpi_merge_queue SQLs."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    # Point to the actual migrations directory in the project
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 5
    assert "20260520_004_create_patient.sql" in applied
    assert "20260520_005_create_mpi_merge_queue.sql" in applied

    # Verify that the table schema queries were executed
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]

    # Verify each migration table was created
    assert any(
        "CREATE TABLE IF NOT EXISTS patient" in stmt for stmt in executed_statements
    )
    assert any(
        "CREATE TABLE IF NOT EXISTS mpi_merge_queue" in stmt
        for stmt in executed_statements
    )

    # Verify tracking table recording
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_004_create_patient.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_005_create_mpi_merge_queue.sql",
    )


@pytest.mark.asyncio
async def test_rollback_patient_migrations(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that patient migrations rollback drops tables in reverse order."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # 1. Rollback MPI Merge Queue (005)
    conn.fetchrow.return_value = {"filename": "20260520_005_create_mpi_merge_queue.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_005_create_mpi_merge_queue.sql"

    # 2. Rollback Patient (004)
    conn.fetchrow.return_value = {"filename": "20260520_004_create_patient.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_004_create_patient.sql"

    # Verify executing DROP statements in the connection calls
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]
    assert any(
        "DROP TABLE IF EXISTS mpi_merge_queue" in stmt for stmt in executed_statements
    )
    assert any("DROP TABLE IF EXISTS patient" in stmt for stmt in executed_statements)


def test_sql_file_rules_and_details() -> None:
    """Test that migration SQL scripts contain required constraints and comments."""
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    patient_up = migrations_dir / "20260520_004_create_patient.sql"
    mpi_up = migrations_dir / "20260520_005_create_mpi_merge_queue.sql"

    assert patient_up.is_file()
    assert mpi_up.is_file()

    patient_sql = patient_up.read_text(encoding="utf-8")
    mpi_sql = mpi_up.read_text(encoding="utf-8")

    # Verify transaction envelopes
    assert "BEGIN;" in patient_sql
    assert "COMMIT;" in patient_sql
    assert "BEGIN;" in mpi_sql
    assert "COMMIT;" in mpi_sql

    # Verify partial unique index for national_id_number
    assert "national_id_number" in patient_sql
    assert "WHERE national_id_number IS NOT NULL" in patient_sql

    # Verify plain text security comment
    assert "Phase 13 crypto-erase — hiện plaintext MVP" in patient_sql

    # Verify mpi checks
    assert "NUMERIC(5,2)" in mpi_sql
    assert "patient_id_a <> patient_id_b" in mpi_sql
    assert "status IN ('PENDING', 'MERGED', 'REJECTED', 'REVIEW')" in mpi_sql
