"""Tests for patient_medical_profile and pregnancy migrations 006-007."""

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
async def test_apply_medical_profile_and_pregnancy_migrations(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that applying migrations runs both 006 and 007 SQLs."""
    pool, conn = mock_db

    # Database returns empty list of applied migrations
    conn.fetch.return_value = []

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    applied = await runner.apply()

    assert len(applied) >= 7
    assert "20260520_006_create_patient_medical_profile.sql" in applied
    assert "20260520_007_create_pregnancy.sql" in applied

    # Verify that the table creation statements were executed
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]

    assert any(
        "CREATE TABLE IF NOT EXISTS patient_medical_profile" in stmt
        for stmt in executed_statements
    )
    assert any(
        "CREATE TABLE IF NOT EXISTS pregnancy" in stmt for stmt in executed_statements
    )

    # Verify tracking table recording
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_006_create_patient_medical_profile.sql",
    )
    conn.execute.assert_any_await(
        "INSERT INTO schema_migrations (filename) VALUES ($1);",
        "20260520_007_create_pregnancy.sql",
    )


@pytest.mark.asyncio
async def test_rollback_pregnancy_before_medical_profile(
    mock_db: tuple[MagicMock, AsyncMock],
) -> None:
    """Test that rollback drops pregnancy (007) before medical_profile (006)."""
    pool, conn = mock_db

    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    runner = MigrationRunner(pool=pool, migrations_dir=str(migrations_dir))

    # 1. Rollback Pregnancy (007) first
    conn.fetchrow.return_value = {"filename": "20260520_007_create_pregnancy.sql"}
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_007_create_pregnancy.sql"

    # 2. Rollback PatientMedicalProfile (006) second
    conn.fetchrow.return_value = {
        "filename": "20260520_006_create_patient_medical_profile.sql"
    }
    rolled_back = await runner.rollback()
    assert rolled_back == "20260520_006_create_patient_medical_profile.sql"

    # Verify DROP statements were executed
    executed_statements = [call[0][0] for call in conn.execute.await_args_list]
    assert any("DROP TABLE IF EXISTS pregnancy" in stmt for stmt in executed_statements)
    assert any(
        "DROP TABLE IF EXISTS patient_medical_profile" in stmt
        for stmt in executed_statements
    )


def test_sql_file_rules_006_007() -> None:
    """Test that migration SQL scripts contain required constraints and comments."""
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    profile_up = migrations_dir / "20260520_006_create_patient_medical_profile.sql"
    pregnancy_up = migrations_dir / "20260520_007_create_pregnancy.sql"

    assert profile_up.is_file()
    assert pregnancy_up.is_file()

    profile_sql = profile_up.read_text(encoding="utf-8")
    pregnancy_sql = pregnancy_up.read_text(encoding="utf-8")

    # --- Transaction envelopes ---
    assert "BEGIN;" in profile_sql
    assert "COMMIT;" in profile_sql
    assert "BEGIN;" in pregnancy_sql
    assert "COMMIT;" in pregnancy_sql

    # --- 006 patient_medical_profile checks ---
    # 1:1 relationship via UNIQUE constraint on clinic_patient_id
    expected_fk = (
        "clinic_patient_id UUID UNIQUE NOT NULL REFERENCES patient(clinic_patient_id)"
    )
    assert expected_fk in profile_sql

    # Blood type CHECK constraint with all valid values
    for bt in ("A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"):
        assert bt in profile_sql

    # TEXT[] array defaults
    assert "allergies TEXT[] DEFAULT '{}'" in profile_sql
    assert "chronic_diseases TEXT[] DEFAULT '{}'" in profile_sql
    assert "current_medications TEXT[] DEFAULT '{}'" in profile_sql
    assert "surgical_history TEXT[] DEFAULT '{}'" in profile_sql

    # JSONB family_history
    assert "family_history JSONB DEFAULT '{}'" in profile_sql

    # Phase 13 crypto-erase comment
    assert "Phase 13 crypto-erase" in profile_sql

    # --- 007 pregnancy checks ---
    # Outcome CHECK constraint
    expected_outcomes = (
        "outcome IN ('ONGOING','DELIVERED','MISCARRIAGE','TERMINATED','UNKNOWN')"
    )
    assert expected_outcomes in pregnancy_sql

    # EDD > LMP conditional CHECK constraint
    assert "edd_date > lmp_date" in pregnancy_sql

    # edd_date is NOT computed by DB trigger (verified by comment)
    assert "NOT a DB trigger" in pregnancy_sql

    # Indexes exist
    assert "idx_pregnancy_clinic_patient_id" in pregnancy_sql
    assert "idx_pregnancy_outcome" in pregnancy_sql
    assert "idx_pregnancy_primary_doctor_id" in pregnancy_sql

    # location_id FK
    assert "location_id UUID NOT NULL REFERENCES clinic_location(id)" in pregnancy_sql

    # is_high_risk column
    assert "is_high_risk BOOLEAN DEFAULT FALSE" in pregnancy_sql


def test_down_scripts_exist_006_007() -> None:
    """Test that DOWN scripts exist and contain correct DROP statements."""
    migrations_dir = pathlib.Path(__file__).parent.parent / "migrations"
    profile_down = (
        migrations_dir / "20260520_006_create_patient_medical_profile.down.sql"
    )
    pregnancy_down = migrations_dir / "20260520_007_create_pregnancy.down.sql"

    assert profile_down.is_file()
    assert pregnancy_down.is_file()

    profile_down_sql = profile_down.read_text(encoding="utf-8")
    pregnancy_down_sql = pregnancy_down.read_text(encoding="utf-8")

    # Transaction envelopes
    assert "BEGIN;" in profile_down_sql
    assert "COMMIT;" in profile_down_sql
    assert "BEGIN;" in pregnancy_down_sql
    assert "COMMIT;" in pregnancy_down_sql

    # Correct DROP targets
    assert "DROP TABLE IF EXISTS patient_medical_profile" in profile_down_sql
    assert "DROP TABLE IF EXISTS pregnancy" in pregnancy_down_sql
