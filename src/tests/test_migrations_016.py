"""Tests for migration 016: staff_task table schema and MigrationRunner behavior."""

from __future__ import annotations

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner

MIGRATIONS_DIR = pathlib.Path("src/migrations")
MIGRATION_FILE = "20260521_016_create_staff_task.sql"
DOWN_FILE = "20260521_016_create_staff_task.down.sql"


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


def test_up_sql_creates_staff_task_table() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "CREATE TABLE IF NOT EXISTS staff_task" in sql


def test_up_sql_fk_references_correct() -> None:
    """location_id → clinic_location(id); assigned_to → staff(id)."""
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "REFERENCES clinic_location(id)" in sql
    assert "REFERENCES staff(id)" in sql


def test_up_sql_has_priority_and_status_checks() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    for val in ("URGENT", "HIGH", "NORMAL"):
        assert val in sql
    for val in ("PENDING", "IN_PROGRESS", "DONE", "CANCELLED"):
        assert val in sql


def test_up_sql_has_done_completed_at_constraint() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "staff_task_done_requires_completed_at" in sql


def test_up_sql_has_all_indexes() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    for idx in (
        "idx_staff_task_assigned",
        "idx_staff_task_source",
        "idx_staff_task_due",
    ):
        assert idx in sql, f"Missing index: {idx}"


def test_up_sql_has_updated_at_trigger() -> None:
    sql = (MIGRATIONS_DIR / MIGRATION_FILE).read_text()
    assert "staff_task_set_updated_at" in sql


def test_down_sql_drops_table_and_indexes() -> None:
    sql = (MIGRATIONS_DIR / DOWN_FILE).read_text()
    assert "DROP TABLE IF EXISTS staff_task" in sql
    assert "DROP TRIGGER IF EXISTS staff_task_set_updated_at" in sql
    for idx in (
        "idx_staff_task_assigned",
        "idx_staff_task_source",
        "idx_staff_task_due",
    ):
        assert idx in sql, f"DOWN missing DROP for: {idx}"


@pytest.mark.asyncio
async def test_runner_applies_016(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE in applied


@pytest.mark.asyncio
async def test_runner_rollback_016(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.return_value = []
    conn.fetchrow.return_value = {"filename": MIGRATION_FILE}
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    rolled_back = await runner.rollback()
    assert rolled_back == MIGRATION_FILE
