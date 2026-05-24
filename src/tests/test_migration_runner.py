"""Tests for the asynchronous database migration runner."""

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
async def test_apply_empty_directory(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that applying migrations with an empty folder succeeds without errors."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    applied = await runner.apply()

    assert applied == []
    conn.execute.assert_awaited_once()  # ensures ensure_table is called
    conn.fetch.assert_awaited_once_with("SELECT filename FROM schema_migrations;")


@pytest.mark.asyncio
async def test_apply_new_migration(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that applying a new migration runs it and records it."""
    pool, conn = mock_db

    # Create dummy migration file
    up_file = tmp_path / "20260520_001_create_test_table.sql"
    sql_content = "CREATE TABLE test (id INT);"
    up_file.write_text(sql_content, encoding="utf-8")

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    applied = await runner.apply()

    assert applied == ["20260520_001_create_test_table.sql"]

    # Verify SQL execution and tracking insert
    conn.execute.assert_any_await("CREATE TABLE test (id INT);")
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_001_create_test_table.sql",
    )


@pytest.mark.asyncio
async def test_apply_idempotent_skips_applied(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that already applied migrations are skipped (idempotent)."""
    pool, conn = mock_db

    # Create dummy migration file
    up_file = tmp_path / "20260520_001_create_test_table.sql"
    up_file.write_text("CREATE TABLE test (id INT);", encoding="utf-8")

    # Database returns that the file is already applied
    conn.fetch.return_value = [{"filename": "20260520_001_create_test_table.sql"}]

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    applied = await runner.apply()

    assert applied == []

    # Verify that the SQL was NOT executed and no INSERT occurred
    for call in conn.execute.await_args_list:
        args = call[0]
        assert "CREATE TABLE test" not in args[0]
        assert "INSERT INTO schema_migrations" not in args[0]


@pytest.mark.asyncio
async def test_mark_applied_records_without_executing_sql(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """mark_applied inserts the tracking row but never runs the migration SQL."""
    pool, conn = mock_db

    # Even if a real .sql file exists, its content must NOT be read/executed.
    real_file = tmp_path / "fake_001.sql"
    real_file.write_text("CREATE TABLE should_not_run (id INT);", encoding="utf-8")

    # No migrations tracked yet.
    conn.fetch.return_value = []

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    marked = await runner.mark_applied(["fake_001.sql"])

    assert marked == ["fake_001.sql"]

    # The tracking INSERT must have happened with the exact filename.
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "fake_001.sql",
    )

    # The migration file's own SQL must NEVER be executed; only the
    # schema_migrations bookkeeping (ensure_table + INSERT) is allowed.
    for call in conn.execute.await_args_list:
        sql = call[0][0]
        assert "should_not_run" not in sql
        if "CREATE TABLE" in sql:
            assert "schema_migrations" in sql


@pytest.mark.asyncio
async def test_mark_applied_idempotent_skips_tracked(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """mark_applied skips filenames already present in schema_migrations."""
    pool, conn = mock_db

    # File is already tracked.
    conn.fetch.return_value = [{"filename": "fake_001.sql"}]

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    marked = await runner.mark_applied(["fake_001.sql"])

    assert marked == []

    # No INSERT should be issued for an already-tracked file.
    for call in conn.execute.await_args_list:
        sql = call[0][0]
        assert "INSERT INTO schema_migrations" not in sql


@pytest.mark.asyncio
async def test_rollback_no_applied_migrations(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that rolling back when no migrations exist returns None."""
    pool, conn = mock_db
    conn.fetchrow.return_value = None

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    rolled_back = await runner.rollback()

    assert rolled_back is None
    conn.fetchrow.assert_awaited_once_with(
        "SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1;"
    )


@pytest.mark.asyncio
async def test_rollback_success(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that rollback successfully executes corresponding down script
    and deletes row.
    """
    pool, conn = mock_db

    # Create dummy down migration file
    down_file = tmp_path / "20260520_001_create_test_table.down.sql"
    sql_content = "DROP TABLE test;"
    down_file.write_text(sql_content, encoding="utf-8")

    # Database returns latest applied migration
    conn.fetchrow.return_value = {"filename": "20260520_001_create_test_table.sql"}

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    rolled_back = await runner.rollback()

    assert rolled_back == "20260520_001_create_test_table.sql"

    # Verify SQL execution and tracking delete
    conn.execute.assert_any_await("DROP TABLE test;")
    conn.execute.assert_any_await(
        "DELETE FROM schema_migrations WHERE filename = $1;",
        "20260520_001_create_test_table.sql",
    )


@pytest.mark.asyncio
async def test_rollback_missing_down_script(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that rollback raises FileNotFoundError if matching down
    script is missing.
    """
    pool, conn = mock_db

    # Database returns latest applied migration but down file is missing
    conn.fetchrow.return_value = {"filename": "20260520_001_create_test_table.sql"}

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))

    with pytest.raises(FileNotFoundError) as exc:
        await runner.rollback()

    assert "Corresponding down migration file not found" in str(exc.value)


@pytest.mark.asyncio
async def test_status(
    mock_db: tuple[MagicMock, AsyncMock], tmp_path: pathlib.Path
) -> None:
    """Test that status correctly returns and lists applied vs pending migrations."""
    pool, conn = mock_db

    # Create dummy migration files (one will be applied, one pending)
    (tmp_path / "20260520_001_create_test.sql").write_text(
        "SELECT 1;", encoding="utf-8"
    )
    (tmp_path / "20260520_002_create_test_two.sql").write_text(
        "SELECT 2;", encoding="utf-8"
    )

    # Mock database to say migration 1 is applied
    conn.fetch.return_value = [{"filename": "20260520_001_create_test.sql"}]

    runner = MigrationRunner(pool=pool, migrations_dir=str(tmp_path))
    stats = await runner.status()

    assert stats["applied"] == ["20260520_001_create_test.sql"]
    assert stats["pending"] == ["20260520_002_create_test_two.sql"]
