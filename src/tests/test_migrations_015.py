"""Tests for migration 015: lab_result table schema and MigrationRunner behavior."""

from __future__ import annotations

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner

MIGRATIONS_DIR = pathlib.Path("src/migrations")
MIGRATION_FILE = "20260521_015_create_lab_result.sql"
DOWN_FILE = "20260521_015_create_lab_result.down.sql"


@pytest.fixture
def mock_db() -> tuple[MagicMock, AsyncMock]:
    pool = MagicMock()
    conn = AsyncMock()
    conn.transaction = MagicMock()
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__.return_value = conn
    pool.acquire.return_value = acquire_ctx
    tx_ctx = AsyncMock()
    tx_ctx.__aenter__.return_value = None
    tx_ctx.__aexit__.return_value = False
    conn.transaction.return_value = tx_ctx
    return pool, conn


def test_migration_up_file_exists() -> None:
    assert (MIGRATIONS_DIR / MIGRATION_FILE).is_file()


def test_migration_down_file_exists() -> None:
    assert (MIGRATIONS_DIR / DOWN_FILE).is_file()


def test_up_sql_creates_lab_result_table() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "CREATE TABLE IF NOT EXISTS lab_result" in sql


def test_up_sql_fk_references_correct() -> None:
    """FK phải dùng patient(clinic_patient_id), appointment(id), staff(id)."""
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "REFERENCES patient(clinic_patient_id)" in sql
    assert "REFERENCES appointment(id)" in sql
    assert "REFERENCES staff(id)" in sql


def test_up_sql_has_triage_group_check() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    for val in ("GROUP_A", "GROUP_B", "GROUP_C", "PENDING"):
        assert val in sql


def test_up_sql_has_safety_gate_columns() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "requires_doctor_review" in sql
    assert "is_finalized" in sql
    assert "reviewed_by_staff_id" in sql


def test_up_sql_has_finalized_check_constraint() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "lab_result_finalized_requires_reviewer" in sql


def test_up_sql_has_all_indexes() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    for idx in (
        "idx_lab_result_patient",
        "idx_lab_result_triage_pending",
        "idx_lab_result_safety_gate",
        "idx_lab_result_appointment",
    ):
        assert idx in sql, f"Missing index: {idx}"


def test_up_sql_has_updated_at_trigger() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "lab_result_set_updated_at" in sql


def test_down_sql_drops_table_and_indexes() -> None:
    sql = (MIGRATIONS_DIR / DOWN_FILE).read_text()
    assert "DROP TABLE IF EXISTS lab_result" in sql
    assert "DROP TRIGGER IF EXISTS lab_result_set_updated_at" in sql
    for idx in (
        "idx_lab_result_patient",
        "idx_lab_result_triage_pending",
        "idx_lab_result_safety_gate",
        "idx_lab_result_appointment",
    ):
        assert idx in sql, f"DOWN missing DROP for: {idx}"


@pytest.mark.asyncio
async def test_runner_applies_015(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE in applied


@pytest.mark.asyncio
async def test_runner_skips_015_if_already_applied(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[{"filename": MIGRATION_FILE}]]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE not in applied


@pytest.mark.asyncio
async def test_runner_rollback_015(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.return_value = []
    conn.fetchrow.return_value = {"filename": MIGRATION_FILE}
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    rolled_back = await runner.rollback()
    assert rolled_back == MIGRATION_FILE


@pytest.mark.asyncio
async def test_runner_status_includes_015(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    status = await runner.status()
    assert MIGRATION_FILE in status["pending"]
