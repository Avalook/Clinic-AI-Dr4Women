"""Patient context aggregation for the pre-visit brief flow (P9.5).

Pulls patient demographics, medical profile, current pregnancy (if any),
last completed appointment date, and recent lab results into a single
PatientContext value. The brief LLM consumes this object — no clinical
decisions are encoded here, only data shaping.

Mode selection:
- The materialized `patient_summary` table does NOT exist in the current
  schema. `USE_MATERIALIZED` is therefore hard-coded `False` (Mode B).
  When P13 ships the materialized view, flip this flag (and add a
  `_fetch_materialized` branch) without touching call sites.

Visit substitute:
- The spec assumed a `visit` table. The codebase has no such table; the
  closest analog already used by `patient_service.get_summary_data()` is
  `appointment(status='COMPLETED')`. Clinical fields (summary, diagnosis,
  ultrasound, ongoing_issues) have no source today and degrade to empty.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from clinicai.tools._common.context import TraceContext

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)

# Hard-coded until P13 ships the materialized view.
# TODO(P13): auto-detect via `to_regclass('public.patient_summary')`.
USE_MATERIALIZED = False

SourceMode = Literal["MATERIALIZED", "ON_DEMAND"]

# Recent record caps — keep the LLM input tight.
_RECENT_LAB_LIMIT = 5


class PatientContext(BaseModel):
    """Aggregated patient data — input to the pre-visit brief LLM."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    clinic_patient_id: UUID
    patient_code: str
    full_name: str
    date_of_birth: date | None

    # Pregnancy (nullable when no ONGOING pregnancy)
    current_ga_weeks: float | None
    current_pregnancy_id: UUID | None
    pregnancy_complications: list[str] = Field(default_factory=list)

    # Medical profile
    chronic_diseases: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    blood_type: str | None

    # Latest visit — sourced from appointment(status='COMPLETED')
    last_visit_date: datetime | None
    last_visit_summary: dict[str, Any] | None
    last_visit_diagnosis: list[str] = Field(default_factory=list)

    # Latest lab results (recent N) + pending GROUP_C queue
    latest_lab_results: list[dict[str, Any]] = Field(default_factory=list)
    pending_lab_review: list[dict[str, Any]] = Field(default_factory=list)

    # Latest ultrasound — no source table today
    latest_ultrasound_summary: list[dict[str, Any]] = Field(default_factory=list)

    # Ongoing issues — no source today (P13 may surface from a clinical
    # encounter table)
    ongoing_issues: list[str] = Field(default_factory=list)

    # Metadata
    data_freshness: datetime
    source_mode: SourceMode


# ---------------------------------------------------------------------------
# Mode B SQL — small, parameterized, no f-string interpolation of values.
# ---------------------------------------------------------------------------

_PATIENT_JOIN_PROFILE_SQL = """
    SELECT
        p.clinic_patient_id,
        p.patient_code,
        p.full_name,
        p.date_of_birth,
        pmp.blood_type,
        pmp.allergies,
        pmp.chronic_diseases,
        pmp.current_medications
    FROM patient p
    LEFT JOIN patient_medical_profile pmp
        ON pmp.clinic_patient_id = p.clinic_patient_id
    WHERE p.clinic_patient_id = $1
    LIMIT 1
"""

_CURRENT_PREGNANCY_SQL = """
    SELECT
        id AS pregnancy_id,
        lmp_date,
        edd_date,
        gestational_age_at_registration,
        outcome,
        is_high_risk,
        high_risk_reason
    FROM pregnancy
    WHERE clinic_patient_id = $1
      AND outcome = 'ONGOING'
    ORDER BY created_at DESC
    LIMIT 1
"""

_LAST_COMPLETED_APPOINTMENT_SQL = """
    SELECT slot_start
    FROM appointment
    WHERE clinic_patient_id = $1
      AND status = 'COMPLETED'
    ORDER BY slot_start DESC
    LIMIT 1
"""

_RECENT_LABS_SQL = """
    SELECT
        lab_result_id,
        test_code,
        test_name,
        panel_code,
        result_value,
        flag,
        triage_group,
        triage_reason,
        requires_doctor_review,
        is_finalized,
        result_received_at
    FROM lab_result
    WHERE clinic_patient_id = $1
    ORDER BY result_received_at DESC
    LIMIT $2
"""


class PatientNotFoundError(ValueError):
    """Raised when no patient row matches the requested clinic_patient_id."""


def _compute_ga_weeks(lmp_date: date | None, today: date) -> float | None:
    """Compute current gestational age in weeks from LMP. Returns None if no LMP.

    Uses LMP rather than EDD because EDD is derived; LMP is the recorded
    anchor and matches OB convention (40w from LMP).
    """
    if lmp_date is None:
        return None
    days = (today - lmp_date).days
    if days < 0:
        return None
    return round(days / 7.0, 1)


def _pregnancy_complications(record: "asyncpg.Record | None") -> list[str]:
    """Surface high_risk_reason as the sole complication signal we have.

    The schema doesn't carry a free-form complications list. This is the
    only structured field today; P13 may add per-pregnancy event rows.
    """
    if record is None:
        return []
    if not record.get("is_high_risk"):
        return []
    reason = record.get("high_risk_reason")
    return [str(reason)] if reason else ["High-risk pregnancy"]


def _lab_to_dict(record: "asyncpg.Record") -> dict[str, Any]:
    """Project a lab_result row into a brief-friendly dict."""
    return {
        "lab_result_id": str(record["lab_result_id"]),
        "test_code": record["test_code"],
        "test_name": record["test_name"],
        "panel_code": record["panel_code"],
        "result_value": record["result_value"],
        "flag": record["flag"],
        "triage_group": record["triage_group"],
        "triage_reason": record["triage_reason"],
        "requires_doctor_review": record["requires_doctor_review"],
        "is_finalized": record["is_finalized"],
        "result_received_at": (
            record["result_received_at"].isoformat()
            if record["result_received_at"] is not None
            else None
        ),
    }


async def _fetch_patient_profile(
    conn: "asyncpg.Connection", clinic_patient_id: UUID
) -> "asyncpg.Record | None":
    return await conn.fetchrow(_PATIENT_JOIN_PROFILE_SQL, clinic_patient_id)


async def _fetch_current_pregnancy(
    conn: "asyncpg.Connection", clinic_patient_id: UUID
) -> "asyncpg.Record | None":
    return await conn.fetchrow(_CURRENT_PREGNANCY_SQL, clinic_patient_id)


async def _fetch_last_completed_appointment(
    conn: "asyncpg.Connection", clinic_patient_id: UUID
) -> "asyncpg.Record | None":
    return await conn.fetchrow(_LAST_COMPLETED_APPOINTMENT_SQL, clinic_patient_id)


async def _fetch_recent_labs(
    conn: "asyncpg.Connection", clinic_patient_id: UUID
) -> "list[asyncpg.Record]":
    rows = await conn.fetch(_RECENT_LABS_SQL, clinic_patient_id, _RECENT_LAB_LIMIT)
    return list(rows)


async def _aggregate_on_demand(
    pool: "asyncpg.Pool", clinic_patient_id: UUID
) -> PatientContext:
    """Mode B: assemble PatientContext from live SELECTs across 4 tables.

    All four queries run concurrently against a single acquired connection.
    """
    async with pool.acquire() as conn:
        patient_rec, pregnancy_rec, last_appt_rec, lab_rows = await asyncio.gather(
            _fetch_patient_profile(conn, clinic_patient_id),
            _fetch_current_pregnancy(conn, clinic_patient_id),
            _fetch_last_completed_appointment(conn, clinic_patient_id),
            _fetch_recent_labs(conn, clinic_patient_id),
        )

    if patient_rec is None:
        raise PatientNotFoundError(
            f"patient not found: clinic_patient_id={clinic_patient_id}"
        )

    # Pregnancy slot
    current_ga_weeks: float | None = None
    current_pregnancy_id: UUID | None = None
    if pregnancy_rec is not None:
        current_pregnancy_id = pregnancy_rec["pregnancy_id"]
        current_ga_weeks = _compute_ga_weeks(
            pregnancy_rec.get("lmp_date"), date.today()
        )

    # Lab slots
    latest_labs = [_lab_to_dict(r) for r in lab_rows]
    pending_review = [
        labd
        for labd in latest_labs
        if labd["triage_group"] == "GROUP_C"
        and labd["requires_doctor_review"]
        and not labd["is_finalized"]
    ]

    return PatientContext(
        clinic_patient_id=patient_rec["clinic_patient_id"],
        patient_code=patient_rec["patient_code"],
        full_name=patient_rec["full_name"],
        date_of_birth=patient_rec["date_of_birth"],
        current_ga_weeks=current_ga_weeks,
        current_pregnancy_id=current_pregnancy_id,
        pregnancy_complications=_pregnancy_complications(pregnancy_rec),
        chronic_diseases=list(patient_rec["chronic_diseases"] or []),
        current_medications=list(patient_rec["current_medications"] or []),
        allergies=list(patient_rec["allergies"] or []),
        blood_type=patient_rec["blood_type"],
        last_visit_date=(
            last_appt_rec["slot_start"] if last_appt_rec is not None else None
        ),
        last_visit_summary=None,  # appointment carries no clinical summary
        last_visit_diagnosis=[],  # no source today
        latest_lab_results=latest_labs,
        pending_lab_review=pending_review,
        latest_ultrasound_summary=[],  # no table today
        ongoing_issues=[],  # no source today
        data_freshness=datetime.now(tz=timezone.utc),
        source_mode="ON_DEMAND",
    )


async def aggregate_patient_context(
    pool: "asyncpg.Pool",
    clinic_patient_id: UUID,
    trace: TraceContext,
) -> PatientContext:
    """Aggregate patient data for the pre-visit brief.

    Auto-selects Mode A (materialized) or Mode B (live SELECTs). Today
    only Mode B is wired — the materialized table is not yet created.

    Args:
        pool: asyncpg connection pool.
        clinic_patient_id: target patient PK.
        trace: per-invocation TraceContext for observability.

    Returns:
        PatientContext.

    Raises:
        PatientNotFoundError: if no patient row exists.
        asyncpg errors propagate unchanged.
    """
    logger.debug(
        "service.aggregate_patient_context",
        extra={
            "trace_id": str(trace.trace_id),
            "clinic_patient_id": str(clinic_patient_id),
            "mode": "MATERIALIZED" if USE_MATERIALIZED else "ON_DEMAND",
        },
    )
    # Single branch today; left as if/else for the P13 flip.
    if USE_MATERIALIZED:  # pragma: no cover — P13
        raise NotImplementedError(
            "MATERIALIZED mode not wired — patient_summary table does not exist yet"
        )
    return await _aggregate_on_demand(pool, clinic_patient_id)
