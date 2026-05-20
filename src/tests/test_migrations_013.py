"""Tests for schema migration 013 (event log) and constraints."""

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
async def test_apply_runs_013_migration(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that applying migrations runs 013 SQL."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 13
    assert "20260520_013_create_event_log.sql" in applied

    # Verify that tracking table recording is set
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_013_create_event_log.sql",
    )


@pytest.mark.asyncio
async def test_rollback_013(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that rolling back returns 013 down migration."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # Rollback event log (013)
    conn.fetchrow.return_value = {"filename": "20260520_013_create_event_log.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_013_create_event_log.sql"


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
    schema_name = "test_migrations_013_temp"
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
async def test_event_log_schema_elements(temp_schema_db) -> None:
    """Verify table, indexes, trigger function, and triggers exist."""
    conn = temp_schema_db

    # 1. Verify event_log table exists
    table_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'event_log' AND table_schema = CURRENT_SCHEMA
        );
        """
    )
    assert table_exists is True

    # 2. Verify the 4 indexes exist on event_log
    indexes = await conn.fetch(
        """
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'event_log' AND schemaname = CURRENT_SCHEMA;
        """
    )
    index_names = {row["indexname"] for row in indexes}
    assert "idx_event_log_aggregate" in index_names
    assert "idx_event_log_event_type" in index_names
    assert "idx_event_log_correlation" in index_names
    assert "idx_event_log_occurred_at" in index_names

    # 3. Verify trigger function enforce_append_only exists
    func_exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'enforce_append_only' AND n.nspname = CURRENT_SCHEMA
        );
        """
    )
    assert func_exists is True

    # 4. Verify 3 triggers exist on event_log
    triggers = await conn.fetch(
        """
        SELECT tgname FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = 'event_log' AND n.nspname = CURRENT_SCHEMA;
        """
    )
    trigger_names = {row["tgname"] for row in triggers}
    assert "trg_event_log_no_update" in trigger_names
    assert "trg_event_log_no_delete" in trigger_names
    assert "trg_event_log_no_truncate" in trigger_names


@pytest.mark.asyncio
async def test_insert_event_succeeds(temp_schema_db) -> None:
    """Verify inserting a valid event succeeds and sets defaults."""
    conn = temp_schema_db

    # Insert a valid event
    row = await conn.fetchrow(
        """
        INSERT INTO event_log (
            event_type, aggregate_type, aggregate_id, payload, source
        )
        VALUES (
            'appointment.created', 'appointment',
            '00000000-0000-0000-0000-000000000001',
            '{"status": "scheduled"}'::jsonb, 'api'
        )
        RETURNING *;
        """
    )

    assert row["event_id"] is not None
    assert row["event_type"] == "appointment.created"
    assert row["aggregate_type"] == "appointment"
    assert str(row["aggregate_id"]) == "00000000-0000-0000-0000-000000000001"
    assert row["payload"] == '{"status": "scheduled"}'
    assert row["source"] == "api"
    assert row["occurred_at"] is not None
    assert row["recorded_at"] is not None


@pytest.mark.asyncio
async def test_update_event_blocked(temp_schema_db) -> None:
    """Verify UPDATE operation is blocked on event_log."""
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

    # Attempt UPDATE
    with pytest.raises(asyncpg.exceptions.PostgresError) as exc_info:
        await conn.execute(
            """
            UPDATE event_log SET payload = '{"status": "cancelled"}'::jsonb
            WHERE event_id = $1;
            """,
            event_id,
        )

    assert exc_info.value.sqlstate == "42501"
    assert "append-only" in str(exc_info.value)
    assert "UPDATE not allowed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_event_blocked(temp_schema_db) -> None:
    """Verify DELETE operation is blocked on event_log."""
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

    # Attempt DELETE
    with pytest.raises(asyncpg.exceptions.PostgresError) as exc_info:
        await conn.execute(
            "DELETE FROM event_log WHERE event_id = $1;",
            event_id,
        )

    assert exc_info.value.sqlstate == "42501"
    assert "append-only" in str(exc_info.value)
    assert "DELETE not allowed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_truncate_event_blocked(temp_schema_db) -> None:
    """Verify TRUNCATE operation is blocked on event_log."""
    conn = temp_schema_db

    # Insert a valid event
    await conn.execute(
        """
        INSERT INTO event_log (
            event_type, aggregate_type, aggregate_id, payload, source
        )
        VALUES (
            'appointment.created', 'appointment',
            '00000000-0000-0000-0000-000000000001',
            '{"status": "scheduled"}'::jsonb, 'api'
        )
        """
    )

    # Attempt TRUNCATE
    with pytest.raises(asyncpg.exceptions.PostgresError) as exc_info:
        await conn.execute("TRUNCATE TABLE event_log;")

    assert exc_info.value.sqlstate == "42501"
    assert "append-only" in str(exc_info.value)
    assert "TRUNCATE not allowed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_event_type_format_constraint(temp_schema_db) -> None:
    """Verify CHECK constraint on event_type format."""
    conn = temp_schema_db

    # 1. Invalid formats should fail
    invalid_types = [
        "INVALID",
        "appointment.Created",
        "app.created.twice",
        "app.",
        ".created",
    ]
    for t in invalid_types:
        with pytest.raises(asyncpg.exceptions.CheckViolationError):
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO event_log (
                        event_type, aggregate_type, aggregate_id, payload, source
                    )
                    VALUES (
                        $1, 'appointment', '00000000-0000-0000-0000-000000000001',
                        '{"status": "scheduled"}'::jsonb, 'api'
                    );
                    """,
                    t,
                )

    # 2. Valid formats should pass
    valid_types = ["appointment.created", "patient.merged", "lab_order.created"]
    for t in valid_types:
        await conn.execute(
            """
            INSERT INTO event_log (
                event_type, aggregate_type, aggregate_id, payload, source
            )
            VALUES (
                $1, 'appointment', '00000000-0000-0000-0000-000000000001',
                '{"status": "scheduled"}'::jsonb, 'api'
            );
            """,
            t,
        )
