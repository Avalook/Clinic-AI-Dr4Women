"""Tests for migration 018: ultrasound_record + patient_summary VIEW.

Tests run at the SQL-content + mocked-pool MigrationRunner level, matching the
established pattern in test_migrations_015/016/017.py. The repo has no live
Postgres test harness, so positive INSERT / FK-violation / VIEW SELECT cases
are validated by asserting the migration's structural shape — the actual
SQL is executed against Postgres only at deploy time via MigrationRunner.
"""

from __future__ import annotations

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner

MIGRATIONS_DIR = pathlib.Path("src/migrations")
MIGRATION_FILE = "20260522_018_create_ultrasound_and_summary.sql"
DOWN_FILE = "20260522_018_create_ultrasound_and_summary.down.sql"


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


# ---------- file presence ----------


def test_migration_up_file_exists() -> None:
    assert (MIGRATIONS_DIR / MIGRATION_FILE).is_file()


def test_migration_down_file_exists() -> None:
    assert (MIGRATIONS_DIR / DOWN_FILE).is_file()


# ---------- ultrasound_record shape ----------


def test_up_creates_ultrasound_record_table(up_sql: str) -> None:
    assert "CREATE TABLE IF NOT EXISTS ultrasound_record" in up_sql


def test_ultrasound_required_columns(up_sql: str) -> None:
    for col in (
        "ultrasound_id",
        "visit_id",
        "clinic_patient_id",
        "performed_by",
        "pregnancy_id",
        "ultrasound_type",
        "findings",
        "impression",
        "image_refs",
        "gestational_age_weeks",
        "performed_at",
        "created_at",
        "updated_at",
    ):
        assert col in up_sql, f"ultrasound_record missing column: {col}"


def test_ultrasound_visit_fk_not_null_restrict(up_sql: str) -> None:
    expected = (
        "visit_id               UUID NOT NULL REFERENCES visit(visit_id) "
        "ON DELETE RESTRICT"
    )
    assert expected in up_sql


def test_ultrasound_patient_fk_not_null_restrict(up_sql: str) -> None:
    expected = (
        "clinic_patient_id      UUID NOT NULL REFERENCES patient(clinic_patient_id) "
        "ON DELETE RESTRICT"
    )
    assert expected in up_sql


def test_ultrasound_staff_fk_nullable(up_sql: str) -> None:
    # performed_by is NULL because not every scan is attributed
    assert (
        "performed_by           UUID NULL REFERENCES staff(id) ON DELETE RESTRICT"
        in up_sql
    )


def test_ultrasound_pregnancy_fk_nullable(up_sql: str) -> None:
    assert (
        "pregnancy_id           UUID NULL REFERENCES pregnancy(id) ON DELETE RESTRICT"
        in up_sql
    )


def test_ultrasound_image_refs_is_text_array(up_sql: str) -> None:
    assert "image_refs             TEXT[] NULL" in up_sql


def test_ultrasound_no_enum_check_on_type(up_sql: str) -> None:
    # ultrasound_type is intentionally open-category TEXT — no CHECK constraint
    assert "ultrasound_type        TEXT NULL" in up_sql


def test_ultrasound_indexes(up_sql: str) -> None:
    assert "idx_ultrasound_visit" in up_sql
    assert "idx_ultrasound_patient" in up_sql


def test_ultrasound_set_updated_at_trigger(up_sql: str) -> None:
    assert "CREATE TRIGGER ultrasound_record_set_updated_at" in up_sql
    assert "EXECUTE FUNCTION set_updated_at()" in up_sql


# ---------- patient_summary VIEW shape ----------


def test_view_is_regular_not_materialized(up_sql: str) -> None:
    # Q-19 tạm chốt on-demand VIEW
    assert "CREATE OR REPLACE VIEW patient_summary" in up_sql
    assert "MATERIALIZED VIEW" not in up_sql


def test_view_identity_columns(up_sql: str) -> None:
    # All four identity fields named in the packet (using schema-real phone_primary)
    for col in ("p.patient_code", "p.full_name", "p.date_of_birth", "p.phone_primary"):
        assert col in up_sql


def test_view_aggregates_last_visit(up_sql: str) -> None:
    assert "last_visit_at" in up_sql
    assert "MAX(COALESCE(v.checked_in_at, v.created_at))" in up_sql


def test_view_counts_total_visits(up_sql: str) -> None:
    assert "total_visits" in up_sql
    assert "COUNT(*)" in up_sql


def test_view_picks_next_upcoming_appointment(up_sql: str) -> None:
    assert "next_appointment_at" in up_sql
    assert "a.status IN ('SCHEDULED', 'CONFIRMED')" in up_sql
    assert "a.slot_start > NOW()" in up_sql
    assert "ORDER BY a.slot_start ASC" in up_sql


def test_view_picks_latest_lab_with_triage_group(up_sql: str) -> None:
    # Bám schema THẬT: lab_result.triage_group (NOT result_classification)
    assert "last_lab_triage_group" in up_sql
    assert "lr.triage_group" in up_sql
    assert "ORDER BY lr.result_received_at DESC" in up_sql


def test_view_no_refresh_logic(up_sql: str) -> None:
    # Regular view → no refresh trigger / cron
    assert "REFRESH MATERIALIZED VIEW" not in up_sql


# ---------- DOWN migration shape ----------


def test_down_drops_view_first(down_sql: str) -> None:
    v = down_sql.index("DROP VIEW IF EXISTS patient_summary")
    t = down_sql.index("DROP TABLE IF EXISTS ultrasound_record")
    # Dropping view before table (cleaner; table FKs aren't involved but conventional)
    assert v < t


def test_down_drops_trigger_indexes_table(down_sql: str) -> None:
    assert "DROP TRIGGER IF EXISTS ultrasound_record_set_updated_at" in down_sql
    assert "DROP INDEX IF EXISTS idx_ultrasound_patient" in down_sql
    assert "DROP INDEX IF EXISTS idx_ultrasound_visit" in down_sql
    assert "DROP TABLE IF EXISTS ultrasound_record" in down_sql


# ---------- runner integration (mocked pool) ----------


@pytest.mark.asyncio
async def test_runner_applies_018(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE in applied


@pytest.mark.asyncio
async def test_runner_rollback_018(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.return_value = []
    conn.fetchrow.return_value = {"filename": MIGRATION_FILE}
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    rolled_back = await runner.rollback()
    assert rolled_back == MIGRATION_FILE
