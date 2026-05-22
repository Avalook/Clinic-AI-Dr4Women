"""Tests for migration 017: D3 Clinical Domain.

Covers visit + clinical_record + visit_amendment plus safety triggers.

Verifies SQL content (schema shape, FKs, safety triggers) plus MigrationRunner
apply/rollback against a mocked asyncpg pool. Live-DB integration of the
triggers is intentionally out of scope here — the project uses mocked pools
across migration tests (see test_migrations_015.py / 016.py).
"""

from __future__ import annotations

import pathlib
from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.migrations.runner import MigrationRunner

MIGRATIONS_DIR = pathlib.Path("src/migrations")
MIGRATION_FILE = "20260522_017_create_clinical_domain.sql"
DOWN_FILE = "20260522_017_create_clinical_domain.down.sql"


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


# ---------- visit table shape ----------


def test_up_creates_visit_table(up_sql: str) -> None:
    assert "CREATE TABLE IF NOT EXISTS visit" in up_sql


def test_visit_status_check_has_all_states(up_sql: str) -> None:
    for state in ("OPEN", "IN_PROGRESS", "FINALIZED", "AMENDED"):
        assert state in up_sql, f"visit.status missing state: {state}"


def test_visit_fk_targets_present(up_sql: str) -> None:
    # All declared FK targets per canon §5
    assert "REFERENCES patient(clinic_patient_id) ON DELETE RESTRICT" in up_sql
    assert "REFERENCES appointment(id) ON DELETE RESTRICT" in up_sql
    assert "REFERENCES work_session(id) ON DELETE RESTRICT" in up_sql
    assert "REFERENCES staff(id) ON DELETE RESTRICT" in up_sql
    assert "REFERENCES clinic_location(id) ON DELETE RESTRICT" in up_sql
    assert "REFERENCES service_type(id) ON DELETE RESTRICT" in up_sql


def test_visit_patient_index(up_sql: str) -> None:
    assert "idx_visit_patient" in up_sql
    assert "ON visit(clinic_patient_id)" in up_sql


def test_visit_appointment_nullable_for_walkin(up_sql: str) -> None:
    # Walk-in visits have no appointment — column must be nullable
    assert "appointment_id        UUID NULL REFERENCES appointment(id)" in up_sql


# ---------- clinical_record table shape ----------


def test_up_creates_clinical_record_table(up_sql: str) -> None:
    assert "CREATE TABLE IF NOT EXISTS clinical_record" in up_sql


def test_clinical_record_visit_unique(up_sql: str) -> None:
    # 1:1 with visit — UNIQUE on visit_id
    assert "UNIQUE REFERENCES visit(visit_id)" in up_sql
    # And that constraint is attached to clinical_record.visit_id
    assert "visit_id" in up_sql and "ON DELETE RESTRICT" in up_sql


def test_clinical_record_soap_columns(up_sql: str) -> None:
    for col in ("soap_subjective", "soap_objective", "soap_assessment", "soap_plan"):
        assert f"{col}" in up_sql
        # All SOAP slices must be JSONB
        assert f"{col}" in up_sql and "JSONB" in up_sql


def test_clinical_record_voice_columns(up_sql: str) -> None:
    assert "voice_note_url" in up_sql
    assert "voice_transcript" in up_sql
    assert "voice_note_reviewed       BOOLEAN NOT NULL DEFAULT FALSE" in up_sql


def test_clinical_record_pregnancy_fk_wired(up_sql: str) -> None:
    # pregnancy table exists in migration 007 → real FK is required
    assert "pregnancy_id              UUID NULL REFERENCES pregnancy(id)" in up_sql


# ---------- visit_amendment table shape ----------


def test_up_creates_visit_amendment_table(up_sql: str) -> None:
    assert "CREATE TABLE IF NOT EXISTS visit_amendment" in up_sql


def test_visit_amendment_required_columns(up_sql: str) -> None:
    for col in (
        "amendment_id",
        "visit_id",
        "amended_by",
        "amended_at",
        "reason",
        "corrected_fields",
        "original_values",
        "corrected_values",
    ):
        assert col in up_sql, f"visit_amendment missing column: {col}"


def test_visit_amendment_corrected_fields_is_text_array(up_sql: str) -> None:
    assert "corrected_fields   TEXT[] NOT NULL" in up_sql


def test_visit_amendment_jsonb_payloads_not_null(up_sql: str) -> None:
    assert "original_values    JSONB NOT NULL" in up_sql
    assert "corrected_values   JSONB NOT NULL" in up_sql


# ---------- safety triggers ----------


def test_finalized_block_function_defined(up_sql: str) -> None:
    assert "CREATE OR REPLACE FUNCTION visit_finalized_block_update()" in up_sql


def test_finalized_block_allows_finalized_to_amended(up_sql: str) -> None:
    # Logic: raise unless transitioning to AMENDED
    assert "OLD.status = 'FINALIZED' AND NEW.status <> 'AMENDED'" in up_sql


def test_finalized_block_raises_exception(up_sql: str) -> None:
    assert "RAISE EXCEPTION" in up_sql
    assert "TT13/2011/TT-BYT" in up_sql


def test_finalized_block_trigger_attached_to_visit(up_sql: str) -> None:
    assert "CREATE TRIGGER trg_visit_finalized_block" in up_sql
    assert "BEFORE UPDATE ON visit" in up_sql


def test_amendment_append_only_function_defined(up_sql: str) -> None:
    assert "CREATE OR REPLACE FUNCTION visit_amendment_append_only()" in up_sql


def test_amendment_append_only_blocks_update(up_sql: str) -> None:
    assert "CREATE TRIGGER trg_visit_amendment_no_update" in up_sql
    assert "BEFORE UPDATE ON visit_amendment" in up_sql


def test_amendment_append_only_blocks_delete(up_sql: str) -> None:
    assert "CREATE TRIGGER trg_visit_amendment_no_delete" in up_sql
    assert "BEFORE DELETE ON visit_amendment" in up_sql


def test_set_updated_at_triggers_attached(up_sql: str) -> None:
    assert "CREATE TRIGGER visit_set_updated_at" in up_sql
    assert "CREATE TRIGGER clinical_record_set_updated_at" in up_sql


# ---------- DOWN migration shape ----------


def test_down_drops_tables_in_fk_order(down_sql: str) -> None:
    # visit_amendment first (FKs visit), clinical_record next (FKs visit), visit last
    a = down_sql.index("DROP TABLE IF EXISTS visit_amendment;")
    c = down_sql.index("DROP TABLE IF EXISTS clinical_record;")
    v = down_sql.index("DROP TABLE IF EXISTS visit;")
    assert a < c < v, "DOWN must drop in reverse-FK order"


def test_down_drops_all_triggers(down_sql: str) -> None:
    for trg in (
        "trg_visit_finalized_block",
        "trg_visit_amendment_no_update",
        "trg_visit_amendment_no_delete",
        "visit_set_updated_at",
        "clinical_record_set_updated_at",
    ):
        assert trg in down_sql, f"DOWN missing DROP TRIGGER for {trg}"


def test_down_drops_trigger_functions(down_sql: str) -> None:
    assert "DROP FUNCTION IF EXISTS visit_amendment_append_only()" in down_sql
    assert "DROP FUNCTION IF EXISTS visit_finalized_block_update()" in down_sql


def test_down_drops_indexes(down_sql: str) -> None:
    assert "DROP INDEX IF EXISTS idx_visit_patient" in down_sql
    assert "DROP INDEX IF EXISTS idx_visit_amendment_visit" in down_sql


# ---------- runner integration (mocked pool) ----------


@pytest.mark.asyncio
async def test_runner_applies_017(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.side_effect = [[], []]
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    applied = await runner.apply()
    assert MIGRATION_FILE in applied


@pytest.mark.asyncio
async def test_runner_rollback_017(mock_db: tuple[MagicMock, AsyncMock]) -> None:
    pool, conn = mock_db
    conn.fetch.return_value = []
    conn.fetchrow.return_value = {"filename": MIGRATION_FILE}
    conn.execute.return_value = None
    runner = MigrationRunner(pool=pool, migrations_dir=str(MIGRATIONS_DIR))
    rolled_back = await runner.rollback()
    assert rolled_back == MIGRATION_FILE
