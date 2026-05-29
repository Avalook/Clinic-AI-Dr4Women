"""Tests for migrations 026-028 — closes the 3 Phase-1 schema debts
documented in SYSTEM_STATE_ACTUAL §2.1 (booking_channel,
patient_contact_channel, patient_next_of_kin).

SQL-content asserts only — mirrors the 020 / 021-024 / 025 pattern.
"""

from __future__ import annotations

import pathlib

import pytest

MIGRATIONS_DIR = pathlib.Path("src/migrations")
SEED_DIR = MIGRATIONS_DIR / "seed"

SUITE: tuple[tuple[str, str], ...] = (
    ("20260529_026_create_booking_channel", "booking_channel"),
    (
        "20260529_027_create_patient_contact_channel",
        "patient_contact_channel",
    ),
    ("20260529_028_create_patient_next_of_kin", "patient_next_of_kin"),
)


@pytest.mark.parametrize("prefix,table", SUITE)
def test_up_file_exists(prefix: str, table: str) -> None:
    assert (MIGRATIONS_DIR / f"{prefix}.sql").is_file()


@pytest.mark.parametrize("prefix,table", SUITE)
def test_down_file_exists(prefix: str, table: str) -> None:
    assert (MIGRATIONS_DIR / f"{prefix}.down.sql").is_file()


@pytest.mark.parametrize("prefix,table", SUITE)
def test_up_creates_table_with_uuid_pk(prefix: str, table: str) -> None:
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text(encoding="utf-8")
    assert f"CREATE TABLE IF NOT EXISTS {table}" in sql
    assert "id UUID PRIMARY KEY DEFAULT gen_random_uuid()" in sql


@pytest.mark.parametrize("prefix,table", SUITE)
def test_up_has_timestamp_columns(prefix: str, table: str) -> None:
    sql = (MIGRATIONS_DIR / f"{prefix}.sql").read_text(encoding="utf-8")
    assert "created_at TIMESTAMPTZ" in sql


@pytest.mark.parametrize("prefix,table", SUITE)
def test_down_drops_table(prefix: str, table: str) -> None:
    sql = (MIGRATIONS_DIR / f"{prefix}.down.sql").read_text(encoding="utf-8")
    assert f"DROP TABLE IF EXISTS {table}" in sql


# --------------------------------------------------------------------------- #
# Migration-specific shape checks                                             #
# --------------------------------------------------------------------------- #


def test_booking_channel_category_check_constraint() -> None:
    sql = (MIGRATIONS_DIR / "20260529_026_create_booking_channel.sql").read_text(
        encoding="utf-8"
    )
    assert "CHECK (category IN" in sql
    for cat in ("ZALO", "FACEBOOK", "HOTLINE", "WALK_IN", "REFERRAL"):
        assert f"'{cat}'" in sql


def test_booking_channel_code_unique() -> None:
    sql = (MIGRATIONS_DIR / "20260529_026_create_booking_channel.sql").read_text(
        encoding="utf-8"
    )
    assert "code TEXT UNIQUE NOT NULL" in sql


def test_patient_contact_channel_fk_cascade() -> None:
    sql = (
        MIGRATIONS_DIR / "20260529_027_create_patient_contact_channel.sql"
    ).read_text(encoding="utf-8")
    assert "REFERENCES patient(clinic_patient_id) ON DELETE CASCADE" in sql


def test_patient_contact_channel_type_check() -> None:
    sql = (
        MIGRATIONS_DIR / "20260529_027_create_patient_contact_channel.sql"
    ).read_text(encoding="utf-8")
    for ct in ("ZALO", "PHONE", "FACEBOOK", "EMAIL"):
        assert f"'{ct}'" in sql


def test_patient_contact_channel_one_primary_per_patient() -> None:
    """Partial UNIQUE on (clinic_patient_id) WHERE is_primary = TRUE."""
    sql = (
        MIGRATIONS_DIR / "20260529_027_create_patient_contact_channel.sql"
    ).read_text(encoding="utf-8")
    assert "idx_patient_contact_channel_primary" in sql
    assert "WHERE is_primary = TRUE" in sql


def test_patient_contact_channel_triple_unique() -> None:
    """(patient, channel_type, channel_value) cannot duplicate."""
    sql = (
        MIGRATIONS_DIR / "20260529_027_create_patient_contact_channel.sql"
    ).read_text(encoding="utf-8")
    assert "idx_patient_contact_channel_uniq" in sql
    assert "(clinic_patient_id, channel_type, channel_value)" in sql


def test_patient_next_of_kin_fk_cascade() -> None:
    sql = (MIGRATIONS_DIR / "20260529_028_create_patient_next_of_kin.sql").read_text(
        encoding="utf-8"
    )
    assert "REFERENCES patient(clinic_patient_id) ON DELETE CASCADE" in sql


def test_patient_next_of_kin_one_primary_per_patient() -> None:
    sql = (MIGRATIONS_DIR / "20260529_028_create_patient_next_of_kin.sql").read_text(
        encoding="utf-8"
    )
    assert "idx_patient_next_of_kin_primary" in sql
    assert "WHERE is_primary_contact = TRUE" in sql


# --------------------------------------------------------------------------- #
# Seed files                                                                  #
# --------------------------------------------------------------------------- #


def test_seed_006_booking_channel_has_seven_rows() -> None:
    sql = (SEED_DIR / "006_booking_channel.sql").read_text(encoding="utf-8")
    for code in (
        "ZALO_PK",
        "FB_DR4WOMEN",
        "FB_4WOMEN",
        "FB_ACADEMY",
        "HOTLINE",
        "WALK_IN",
        "REFERRAL",
    ):
        assert f"'{code}'" in sql
    assert "ON CONFLICT (code) DO NOTHING" in sql


def test_seed_007_backfill_only_inserts_missing_rows() -> None:
    sql = (SEED_DIR / "007_backfill_patient_phone_contact.sql").read_text(
        encoding="utf-8"
    )
    assert "INSERT INTO patient_contact_channel" in sql
    assert "WHERE p.phone_primary IS NOT NULL" in sql
    assert "NOT EXISTS" in sql
    # phone_secondary block — non-primary.
    assert "p.phone_secondary" in sql
