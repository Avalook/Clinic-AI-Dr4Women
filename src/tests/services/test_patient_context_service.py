"""Unit tests for clinicai.services.patient_context_service.

The service uses `pool.acquire()` + `asyncio.gather` over a single
connection. The pool fixture returns (pool, conn) with conn.fetchrow and
conn.fetch programmed via side_effect for each gather call.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from clinicai.services.patient_context_service import (
    PatientContext,
    PatientNotFoundError,
    aggregate_patient_context,
)
from clinicai.tools._common.context import new_trace

_PATIENT_ID = UUID("11111111-1111-1111-1111-111111111111")
_NOW = datetime.now(tz=timezone.utc)


def _patient_record(
    *,
    blood_type: str | None = "A+",
    allergies: list[str] | None = None,
    chronic: list[str] | None = None,
    meds: list[str] | None = None,
) -> dict:
    return {
        "clinic_patient_id": _PATIENT_ID,
        "patient_code": "BN-2026-000001",
        "full_name": "Nguyễn Thị A",
        "date_of_birth": date(1992, 4, 15),
        "blood_type": blood_type,
        "allergies": allergies or [],
        "chronic_diseases": chronic or [],
        "current_medications": meds or [],
    }


def _pregnancy_record(
    *,
    is_high_risk: bool = False,
    high_risk_reason: str | None = None,
    lmp_date: date | None = None,
) -> dict:
    return {
        "pregnancy_id": uuid4(),
        "lmp_date": lmp_date,
        "edd_date": None,
        "gestational_age_at_registration": None,
        "outcome": "ONGOING",
        "is_high_risk": is_high_risk,
        "high_risk_reason": high_risk_reason,
    }


def _appointment_record() -> dict:
    return {"slot_start": datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc)}


def _lab_record(
    *,
    triage_group: str = "GROUP_A",
    requires_review: bool = False,
    is_finalized: bool = True,
) -> dict:
    return {
        "lab_result_id": uuid4(),
        "test_code": "CBC",
        "test_name": "Complete Blood Count",
        "panel_code": "CBC",
        "result_value": "OK",
        "flag": "NORMAL",
        "triage_group": triage_group,
        "triage_reason": None,
        "requires_doctor_review": requires_review,
        "is_finalized": is_finalized,
        "result_received_at": _NOW,
    }


def _build_pool(
    *,
    patient: dict | None,
    pregnancy: dict | None,
    appointment: dict | None,
    labs: list[dict],
) -> MagicMock:
    """Build a mock pool that programs the 4 gather'd queries in order.

    Order matches `_aggregate_on_demand`: patient (fetchrow),
    pregnancy (fetchrow), appointment (fetchrow), labs (fetch).
    """
    pool = MagicMock()
    conn = MagicMock()
    conn.fetchrow = AsyncMock(side_effect=[patient, pregnancy, appointment])
    conn.fetch = AsyncMock(return_value=labs)
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__.return_value = conn
    acquire_ctx.__aexit__.return_value = False
    pool.acquire.return_value = acquire_ctx
    return pool


@pytest.mark.asyncio
async def test_aggregate__pregnant_patient__pregnancy_fields_populated() -> None:
    """ONGOING pregnancy with LMP → GA computed, complication surfaced."""
    # Place LMP roughly 24 weeks ago so GA is positive and finite.
    from datetime import timedelta

    lmp_24w = date.today() - timedelta(weeks=24)
    pool = _build_pool(
        patient=_patient_record(),
        pregnancy=_pregnancy_record(
            is_high_risk=True,
            high_risk_reason="Tiền sử tiền sản giật",
            lmp_date=lmp_24w,
        ),
        appointment=_appointment_record(),
        labs=[],
    )

    ctx = await aggregate_patient_context(pool, _PATIENT_ID, new_trace())

    assert isinstance(ctx, PatientContext)
    assert ctx.current_pregnancy_id is not None
    assert ctx.current_ga_weeks is not None
    assert 23.5 <= ctx.current_ga_weeks <= 24.5
    assert ctx.pregnancy_complications == ["Tiền sử tiền sản giật"]


@pytest.mark.asyncio
async def test_aggregate__no_recent_visits__last_visit_none_no_error() -> None:
    """No COMPLETED appointment → last_visit_date is None, no crash."""
    pool = _build_pool(
        patient=_patient_record(),
        pregnancy=None,
        appointment=None,
        labs=[],
    )

    ctx = await aggregate_patient_context(pool, _PATIENT_ID, new_trace())

    assert ctx.last_visit_date is None
    assert ctx.last_visit_summary is None
    assert ctx.last_visit_diagnosis == []


@pytest.mark.asyncio
async def test_aggregate__group_c_pending__included_in_pending_lab_review() -> None:
    """GROUP_C + requires_review + not finalized → surfaces in pending_lab_review."""
    pool = _build_pool(
        patient=_patient_record(),
        pregnancy=None,
        appointment=_appointment_record(),
        labs=[
            _lab_record(
                triage_group="GROUP_A", requires_review=False, is_finalized=True
            ),
            _lab_record(
                triage_group="GROUP_C", requires_review=True, is_finalized=False
            ),
        ],
    )

    ctx = await aggregate_patient_context(pool, _PATIENT_ID, new_trace())

    assert len(ctx.latest_lab_results) == 2
    assert len(ctx.pending_lab_review) == 1
    assert ctx.pending_lab_review[0]["triage_group"] == "GROUP_C"


@pytest.mark.asyncio
async def test_aggregate__patient_not_found__raises_value_error() -> None:
    """Missing patient row → PatientNotFoundError (a ValueError subclass)."""
    pool = _build_pool(
        patient=None,
        pregnancy=None,
        appointment=None,
        labs=[],
    )

    with pytest.raises(PatientNotFoundError):
        await aggregate_patient_context(pool, _PATIENT_ID, new_trace())


@pytest.mark.asyncio
async def test_aggregate__source_mode__matches_detected_mode() -> None:
    """USE_MATERIALIZED=False today → source_mode='ON_DEMAND'."""
    pool = _build_pool(
        patient=_patient_record(),
        pregnancy=None,
        appointment=None,
        labs=[],
    )

    ctx = await aggregate_patient_context(pool, _PATIENT_ID, new_trace())

    assert ctx.source_mode == "ON_DEMAND"
