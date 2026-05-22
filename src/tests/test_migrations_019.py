"""Tests for migration 019: staff_capability table.

SQL-content + mocked-pool MigrationRunner tests, mirroring the established
pattern in test_migrations_015..018.py.
"""

from __future__ import annotations

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner

MIGRATIONS_DIR = pathlib.Path("src/migrations")
MIGRATION_FILE = "20260522_019_create_staff_capability.sql"
DOWN_FILE = "20260522_019_create_staff_capability.down.sql"


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


@pytest.fixture
def up_sql() -> str:
    return (MIGRATIONS_DIR / MIGRATION_FILE).read_text()


@pytest.fixture
def down_sql() -> str:
    return (MIGRATIONS_DIR / DOWN_FILE).read_text()


def test_migration_up_file_exists() -> None:
    assert (MIGRATIONS_DIR / MIGRATION_FILE).is_file()


def test_migration_down_file_exists() -> None:
    assert (MIGRATIONS_DIR / DOWN_FILE).is_file()


def test_up_creates_staff_capability_table(up_sql: str) -> None:
    assert "CREATE TABLE IF NOT EXISTS staff_capability" in up_sql


def test_up_fk_targets_staff_id(up_sql: str) -> None:
    # Actual staff PK is `id` (mig 003), not `staff_id` — verify we wired it right.
    assert "REFERENCES staff(id) ON DELETE CASCADE" in up_sql


def test_up_capability_is_text_no_check(up_sql: str) -> None:
    """D019: capability is free-form TEXT; no DB-level CHECK constraint."""
    assert "capability        TEXT NOT NULL" in up_sql
    # Sanity: no enum-style CHECK on the column.
    assert "CHECK (capability" not in up_sql
    assert "CHECK(capability" not in up_sql


def test_up_unique_constraint(up_sql: str) -> None:
    assert "uq_staff_capability" in up_sql
    assert "UNIQUE (staff_id, capability)" in up_sql


def test_up_indexes(up_sql: str) -> None:
    assert "idx_staff_capability_staff_id" in up_sql
    assert "idx_staff_capability_capability" in up_sql


def test_up_proficiency_default(up_sql: str) -> None:
    assert "proficiency_level TEXT NOT NULL DEFAULT 'COMPETENT'" in up_sql


def test_down_drops_table_and_indexes(down_sql: str) -> None:
    assert "DROP TABLE IF EXISTS staff_capability" in down_sql
    assert "DROP INDEX IF EXISTS idx_staff_capability_staff_id" in down_sql
    assert "DROP INDEX IF EXISTS idx_staff_capability_capability" in down_sql


@pytest.mark.asyncio
async def test_runner_applies_019(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE in applied


@pytest.mark.asyncio
async def test_runner_rollback_019(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.return_value = []
    conn.fetchrow.return_value = {"filename": MIGRATION_FILE}
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    rolled_back = await runner.rollback()
    assert rolled_back == MIGRATION_FILE
