"""Unit tests for PatientService with mock asyncpg pool."""

from __future__ import annotations

import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from clinicai.core.exceptions import ResourceNotFoundError, ValidationError
from clinicai.schemas.patient import PatientCreateDTO, PatientUpdateDTO
from clinicai.services.patient_service import PatientService

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_UUID = uuid4()
FAKE_LOCATION = uuid4()
FAKE_NOW = datetime.datetime(2026, 5, 20, 10, 0, 0, tzinfo=datetime.timezone.utc)


def _make_record(overrides: dict | None = None) -> dict:
    """Build a dict that looks like an asyncpg.Record for the patient table."""
    base = {
        "clinic_patient_id": FAKE_UUID,
        "patient_code": "BN-2026-000001",
        "national_id_number": None,
        "full_name": "Nguyễn Thị Lan",
        "date_of_birth": datetime.date(1990, 3, 15),
        "phone_primary": "+84901234567",
        "phone_secondary": None,
        "location_id": FAKE_LOCATION,
        "is_active": True,
        "created_at": FAKE_NOW,
        "updated_at": FAKE_NOW,
    }
    if overrides:
        base.update(overrides)
    return base


def _mock_pool_and_conn() -> tuple[MagicMock, AsyncMock]:
    """Return (pool, conn) with pool.acquire() wired as async ctx mgr."""
    pool = MagicMock()
    conn = AsyncMock()

    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__.return_value = conn
    pool.acquire.return_value = acquire_ctx

    return pool, conn


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_patient_success() -> None:
    """create_patient should INSERT and return a PatientDTO."""
    pool, conn = _mock_pool_and_conn()
    record = _make_record()
    conn.fetchrow.return_value = record

    svc = PatientService(pool)
    dto = await svc.create_patient(
        PatientCreateDTO(
            full_name="Nguyễn Thị Lan",
            date_of_birth=datetime.date(1990, 3, 15),
            phone_primary="+84901234567",
            location_id=FAKE_LOCATION,
        )
    )

    assert dto.clinic_patient_id == FAKE_UUID
    assert dto.full_name == "Nguyễn Thị Lan"
    assert dto.location_id == FAKE_LOCATION
    assert dto.is_active is True
    # national_id_number was None → stays None after masking
    assert dto.national_id_number is None

    # Verify INSERT was called once
    conn.fetchrow.assert_awaited_once()
    sql_arg = conn.fetchrow.call_args[0][0]
    assert "INSERT INTO patient" in sql_arg


@pytest.mark.asyncio
async def test_create_patient_generates_patient_code() -> None:
    """patient_code should follow BN-YYYY-XXXXXX format."""
    pool, conn = _mock_pool_and_conn()
    record = _make_record()
    conn.fetchrow.return_value = record

    svc = PatientService(pool)
    with patch(
        "clinicai.services.patient_service._generate_patient_code",
        return_value="BN-2026-123456",
    ):
        await svc.create_patient(
            PatientCreateDTO(
                full_name="Trần Văn A",
                location_id=FAKE_LOCATION,
            )
        )

    # The generated code was passed as the first positional arg
    call_args = conn.fetchrow.call_args[0]
    assert call_args[1] == "BN-2026-123456"


@pytest.mark.asyncio
async def test_get_by_id_found() -> None:
    """get_by_id should return PatientDTO when patient exists."""
    pool, conn = _mock_pool_and_conn()
    record = _make_record({"national_id_number": "012345678901"})
    conn.fetchrow.return_value = record

    svc = PatientService(pool)
    dto = await svc.get_by_id(FAKE_UUID)

    assert dto is not None
    assert dto.clinic_patient_id == FAKE_UUID
    # Verify masking: "012345678901" → "012*******01"
    assert dto.national_id_number == "012*******01"

    conn.fetchrow.assert_awaited_once()
    sql_arg = conn.fetchrow.call_args[0][0]
    assert "clinic_patient_id" in sql_arg


@pytest.mark.asyncio
async def test_get_by_id_not_found() -> None:
    """get_by_id should return None when patient does not exist."""
    pool, conn = _mock_pool_and_conn()
    conn.fetchrow.return_value = None

    svc = PatientService(pool)
    result = await svc.get_by_id(uuid4())

    assert result is None


@pytest.mark.asyncio
async def test_get_by_phone_returns_list() -> None:
    """get_by_phone should return a list of PatientDTO matches."""
    pool, conn = _mock_pool_and_conn()
    conn.fetch.return_value = [
        _make_record({"clinic_patient_id": uuid4()}),
        _make_record({"clinic_patient_id": uuid4()}),
    ]

    svc = PatientService(pool)
    results = await svc.get_by_phone("+84901234567")

    assert len(results) == 2
    assert all(r.phone_primary == "+84901234567" for r in results)

    conn.fetch.assert_awaited_once()
    sql_arg = conn.fetch.call_args[0][0]
    assert "phone_primary" in sql_arg


@pytest.mark.asyncio
async def test_get_by_phone_returns_empty() -> None:
    """get_by_phone should return empty list when no matches."""
    pool, conn = _mock_pool_and_conn()
    conn.fetch.return_value = []

    svc = PatientService(pool)
    results = await svc.get_by_phone("+84999999999")

    assert results == []


@pytest.mark.asyncio
async def test_update_patient_success() -> None:
    """update_patient should SET only provided fields and return updated DTO."""
    pool, conn = _mock_pool_and_conn()
    updated_record = _make_record({"full_name": "Lê Thị Hoa", "is_active": False})
    conn.fetchrow.return_value = updated_record

    svc = PatientService(pool)
    dto = await svc.update_patient(
        FAKE_UUID,
        PatientUpdateDTO(full_name="Lê Thị Hoa", is_active=False),
    )

    assert dto.full_name == "Lê Thị Hoa"

    conn.fetchrow.assert_awaited_once()
    sql_arg = conn.fetchrow.call_args[0][0]
    assert "UPDATE patient SET" in sql_arg
    assert "full_name" in sql_arg
    assert "is_active" in sql_arg
    assert "RETURNING" in sql_arg


@pytest.mark.asyncio
async def test_update_patient_not_found() -> None:
    """update_patient should raise ResourceNotFoundError if row missing."""
    pool, conn = _mock_pool_and_conn()
    conn.fetchrow.return_value = None

    svc = PatientService(pool)
    missing_id = uuid4()

    with pytest.raises(ResourceNotFoundError, match=str(missing_id)):
        await svc.update_patient(
            missing_id,
            PatientUpdateDTO(full_name="Nobody"),
        )


@pytest.mark.asyncio
async def test_update_patient_no_fields() -> None:
    """update_patient should raise ValidationError with empty update."""
    pool, _conn = _mock_pool_and_conn()
    svc = PatientService(pool)

    with pytest.raises(ValidationError, match="No fields to update"):
        await svc.update_patient(FAKE_UUID, PatientUpdateDTO())


# ---------------------------------------------------------------------------
# Schema unit tests
# ---------------------------------------------------------------------------


def test_patient_dto_masks_national_id() -> None:
    """PatientDTO should mask national_id_number on construction."""
    from clinicai.schemas.patient import _mask_national_id

    assert _mask_national_id(None) is None
    assert _mask_national_id("012345678901") == "012*******01"
    assert _mask_national_id("12345") == "*****"
    assert _mask_national_id("AB") == "**"


def test_create_dto_rejects_blank_name() -> None:
    """PatientCreateDTO should reject empty/whitespace full_name."""
    with pytest.raises(Exception, match="full_name must not be blank"):
        PatientCreateDTO(
            full_name="   ",
            location_id=uuid4(),
        )


def test_patient_dto_from_record() -> None:
    """PatientDTO should populate from a dict (simulating asyncpg Record)."""
    from clinicai.schemas.patient import PatientDTO

    record = _make_record({"national_id_number": "001099001234"})
    dto = PatientDTO.model_validate(record)

    assert dto.clinic_patient_id == FAKE_UUID
    assert dto.patient_code == "BN-2026-000001"
    # Masked: "001099001234" → "001*******34"
    assert dto.national_id_number == "001*******34"
