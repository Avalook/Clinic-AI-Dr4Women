"""Tests for migrations 021-024: RLS policies on visit / clinical_record /
lab_result / appointment.

SQL-content asserts only — each migration is structurally identical
(``ALTER TABLE ... ENABLE ROW LEVEL SECURITY`` + ``CREATE POLICY ... FOR
SELECT TO authenticated USING (true)``), matching the 020 patient policy.
"""

from __future__ import annotations

import pathlib

import pytest

MIGRATIONS_DIR = pathlib.Path("src/migrations")

# (filename_prefix, table, policy_name)
SUITE: tuple[tuple[str, str, str], ...] = (
    ("20260529_021_rls_visit", "visit", "visit_select_authenticated"),
    (
        "20260529_022_rls_clinical_record",
        "clinical_record",
        "clinical_record_select_authenticated",
    ),
    (
        "20260529_023_rls_lab_result",
        "lab_result",
        "lab_result_select_authenticated",
    ),
    (
        "20260529_024_rls_appointment",
        "appointment",
        "appointment_select_authenticated",
    ),
)


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_up_file_exists(prefix: str, table: str, policy: str) -> None:
    assert (MIGRATIONS_DIR / f"{prefix}.sql").is_file()


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_down_file_exists(prefix: str, table: str, policy: str) -> None:
    assert (MIGRATIONS_DIR / f"{prefix}.down.sql").is_file()


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_up_enables_rls(prefix: str, table: str, policy: str) -> None:
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text()
    assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY" in sql


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_up_creates_authenticated_select_policy(
    prefix: str, table: str, policy: str
) -> None:
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text()
    assert f"DROP POLICY IF EXISTS {policy} ON {table}" in sql
    assert f"CREATE POLICY {policy}" in sql
    assert f"ON {table}" in sql
    assert "FOR SELECT" in sql
    assert "TO authenticated" in sql
    assert "USING (true)" in sql


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_up_does_not_open_anon(prefix: str, table: str, policy: str) -> None:
    """Defense against accidental ``TO anon`` regressions."""
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text()
    assert "TO anon" not in sql


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_up_only_grants_select(prefix: str, table: str, policy: str) -> None:
    """Phase 1 is read-only via Supabase — writes still go through the
    backend (which uses the postgres superuser pool and bypasses RLS)."""
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text()
    assert "FOR INSERT" not in sql
    assert "FOR UPDATE" not in sql
    assert "FOR DELETE" not in sql
    assert "FOR ALL" not in sql


@pytest.mark.parametrize("prefix,table,policy", SUITE)
def test_down_only_drops_policy(prefix: str, table: str, policy: str) -> None:
    """Rollback gỡ policy only; relrowsecurity giữ nguyên trạng thái trước
    migration (mirroring the 020 rollback semantics)."""
    sql = (MIGRATIONS_DIR / f"{prefix}.down.sql").read_text()
    assert f"DROP POLICY IF EXISTS {policy} ON {table}" in sql
    assert "DISABLE ROW LEVEL SECURITY" not in sql
