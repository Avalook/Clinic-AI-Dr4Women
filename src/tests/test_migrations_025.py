"""Tests for migration 025: staff_auth_link.

SQL-content asserts — confirms the migration ADDs the column + FK +
partial-unique index against ``auth.users`` and that the down file
removes them. The 020/021-024 pattern uses parametric content checks
without spinning up a live DB; this follows the same shape.
"""

from __future__ import annotations

import pathlib

MIGRATIONS_DIR = pathlib.Path("src/migrations")
UP = "20260529_025_staff_auth_link.sql"
DOWN = "20260529_025_staff_auth_link.down.sql"


def _up_sql() -> str:
    return (MIGRATIONS_DIR / UP).read_text(encoding="utf-8")


def _down_sql() -> str:
    return (MIGRATIONS_DIR / DOWN).read_text(encoding="utf-8")


# --------------------------------------------------------------------------- #
# Files exist                                                                 #
# --------------------------------------------------------------------------- #


def test_up_file_exists() -> None:
    assert (MIGRATIONS_DIR / UP).is_file()


def test_down_file_exists() -> None:
    assert (MIGRATIONS_DIR / DOWN).is_file()


# --------------------------------------------------------------------------- #
# Up — ADD COLUMN + FK + UNIQUE                                               #
# --------------------------------------------------------------------------- #


def test_up_adds_nullable_uuid_column() -> None:
    sql = _up_sql()
    assert "ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL" in sql


def test_up_creates_fk_to_auth_users_on_delete_set_null() -> None:
    sql = _up_sql()
    assert "staff_auth_user_id_fkey" in sql
    assert "FOREIGN KEY (auth_user_id)" in sql
    assert "REFERENCES auth.users(id)" in sql
    assert "ON DELETE SET NULL" in sql


def test_up_fk_guarded_by_existence_check() -> None:
    """Re-running the migration must not crash on the FK conflict."""
    sql = _up_sql()
    assert "pg_constraint" in sql
    assert "conname = 'staff_auth_user_id_fkey'" in sql


def test_up_unique_index_is_partial_on_notnull() -> None:
    """Many NULLs are allowed (NV chưa cấp acc), only non-NULL mapping
    must be unique."""
    sql = _up_sql()
    assert "CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_auth_user_id_unique" in sql
    assert "ON staff (auth_user_id)" in sql
    assert "WHERE auth_user_id IS NOT NULL" in sql


def test_up_includes_column_comment() -> None:
    sql = _up_sql()
    assert "COMMENT ON COLUMN staff.auth_user_id" in sql


# --------------------------------------------------------------------------- #
# Down — drops index, FK, column                                              #
# --------------------------------------------------------------------------- #


def test_down_drops_index_fk_and_column() -> None:
    sql = _down_sql()
    assert "DROP INDEX IF EXISTS idx_staff_auth_user_id_unique" in sql
    assert "DROP CONSTRAINT IF EXISTS staff_auth_user_id_fkey" in sql
    assert "DROP COLUMN IF EXISTS auth_user_id" in sql
