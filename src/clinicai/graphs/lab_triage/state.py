"""State for lab_triage sub-graph."""

from __future__ import annotations

from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class LabTriageStep(str, Enum):
    RECEIVE = "receive"  # nhận lab_result_id từ orchestrator
    CLASSIFY = "classify"  # rule-based + AI fallback → GROUP_A/B/C
    ADVISE = "advise"  # GROUP_A/B: soạn message cho BN/BS
    HARD_BLOCK = "hard_block"  # GROUP_C: block, escalate BS
    DONE = "done"


class LabTriageState(BaseModel):
    """State passed through lab_triage sub-graph nodes."""

    # Input từ orchestrator
    lab_result_id: Optional[UUID] = None
    clinic_patient_id: Optional[UUID] = None

    # Triage output
    triage_group: Optional[str] = None  # GROUP_A / GROUP_B / GROUP_C
    triage_reason: Optional[str] = None
    requires_doctor_review: bool = False

    # Flow control
    step: LabTriageStep = LabTriageStep.RECEIVE
    turn_count: int = 0

    # Output message
    response_to_patient: Optional[str] = None  # None nếu GROUP_C (hard block)
    escalation_note: Optional[str] = None  # cho BS khi GROUP_B/C
    error: Optional[str] = None
