"""Tests for schema migration 014 (event log event_published column and trigger)."""

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
async def test_apply_runs_014_migration(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that applying migrations runs 014 SQL."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 14
    assert "20260520_014_event_log_add_published.sql" in applied


@pytest.mark.asyncio
async def test_rollback_014(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that rolling back returns 014 down migration."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    conn.fetchrow.return_value = {
        "filename": "20260520_014_event_log_add_published.sql"
    }
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_014_event_log_add_published.sql"


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

    schema_name = "test_migrations_014_temp"
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
async def test_migration_014__event_published_column_exists(temp_schema_db) -> None:
    """Verify that event_published column exists on event_log and defaults to FALSE."""
    conn = temp_schema_db

    col_info = await conn.fetchrow(
        """
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'event_log'
          AND column_name = 'event_published'
          AND table_schema = CURRENT_SCHEMA;
        """
    )
    assert col_info is not None
    assert col_info["column_name"] == "event_published"
    assert col_info["data_type"] == "boolean"
    assert "false" in col_info["column_default"].lower()
    assert col_info["is_nullable"] == "NO"


@pytest.mark.asyncio
async def test_migration_014__update_event_published__succeeds(temp_schema_db) -> None:
    """Verify that we can flip event_published from FALSE to TRUE."""
    conn = temp_schema_db

    # Insert a valid event
    event_id = await conn.fetchval(
        """
        INSERT INTO event_log (
            event_type, aggregate_type, aggregate_id, payload, source
        )
        VALUES (
            'appointment.created', 'appointment',
            '00000000-0000-0000-0000-000000000001',
            '{"status": "scheduled"}'::jsonb, 'api'
        )
        RETURNING event_id;
        """
    )

    # Initially it should be FALSE
    initial_pub = await conn.fetchval(
        "SELECT event_published FROM event_log WHERE event_id = $1", event_id
    )
    assert initial_pub is False

    # Flip FALSE -> TRUE
    await conn.execute(
        "UPDATE event_log SET event_published = TRUE WHERE event_id = $1", event_id
    )

    # Verify it is now TRUE
    updated_pub = await conn.fetchval(
        "SELECT event_published FROM event_log WHERE event_id = $1", event_id
    )
    assert updated_pub is True


@pytest.mark.asyncio
async def test_migration_014__update_event_published_reversion__blocked(
    temp_schema_db,
) -> None:
    """Verify that we CANNOT flip event_published back from TRUE to FALSE."""
    conn = temp_schema_db

    # Insert a valid event
    event_id = await conn.fetchval(
        """
        INSERT INTO event_log (
            event_type, aggregate_type, aggregate_id, payload, source
        )
        VALUES (
            'appointment.created', 'appointment',
            '00000000-0000-0000-0000-000000000001',
            '{"status": "scheduled"}'::jsonb, 'api'
        )
        RETURNING event_id;
        """
    )

    # Flip FALSE -> TRUE
    await conn.execute(
        "UPDATE event_log SET event_published = TRUE WHERE event_id = $1", event_id
    )

    # Try flipping TRUE -> FALSE (should fail)
    with pytest.raises(asyncpg.exceptions.PostgresError) as exc_info:
        await conn.execute(
            "UPDATE event_log SET event_published = FALSE WHERE event_id = $1", event_id
        )

    assert exc_info.value.sqlstate == "42501"
    assert "append-only" in str(exc_info.value)


@pytest.mark.asyncio
async def test_migration_014__update_other_columns__blocked(temp_schema_db) -> None:
    """Verify that we cannot update other columns along with event_published."""
    conn = temp_schema_db

    # Insert a valid event
    event_id = await conn.fetchval(
        """
        INSERT INTO event_log (
            event_type, aggregate_type, aggregate_id, payload, source
        )
        VALUES (
            'appointment.created', 'appointment',
            '00000000-0000-0000-0000-000000000001',
            '{"status": "scheduled"}'::jsonb, 'api'
        )
        RETURNING event_id;
        """
    )

    # Try to flip event_published AND modify payload (should fail)
    with pytest.raises(asyncpg.exceptions.PostgresError) as exc_info:
        await conn.execute(
            """
            UPDATE event_log
            SET event_published = TRUE, payload = '{"status": "modified"}'::jsonb
            WHERE event_id = $1
            """,
            event_id,
        )

    assert exc_info.value.sqlstate == "42501"
    assert "append-only" in str(exc_info.value)
