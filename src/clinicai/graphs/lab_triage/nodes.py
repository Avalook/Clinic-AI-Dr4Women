"""Stub nodes for lab_triage sub-graph — Phase 9.2-01 skeleton."""

from __future__ import annotations

import structlog

from clinicai.graphs.lab_triage.state import LabTriageState, LabTriageStep

logger = structlog.get_logger()


def make_receive_node():
    """Node: nhận lab_result_id, validate, chuyển sang CLASSIFY."""

    async def receive_node(state: LabTriageState) -> LabTriageState:
        logger.info("lab_triage.receive", lab_result_id=str(state.lab_result_id))
        if not state.lab_result_id:
            return state.model_copy(
                update={
                    "step": LabTriageStep.DONE,
                    "error": "missing lab_result_id",
                }
            )
        return state.model_copy(
            update={
                "step": LabTriageStep.CLASSIFY,
                "turn_count": state.turn_count + 1,
            }
        )

    return receive_node


def make_classify_node(pool):
    """Node: classify lab result → GROUP_A/B/C. STUB — real logic T-P9.2-03."""

    async def classify_node(state: LabTriageState) -> LabTriageState:
        logger.info("lab_triage.classify_stub", lab_result_id=str(state.lab_result_id))
        # STUB: luôn trả GROUP_A cho đến T-P9.2-03
        return state.model_copy(
            update={
                "triage_group": "GROUP_A",
                "triage_reason": "stub classification — pending T-P9.2-03",
                "requires_doctor_review": False,
                "step": LabTriageStep.ADVISE,
                "turn_count": state.turn_count + 1,
            }
        )

    return classify_node


def make_advise_node(pool):
    """Node: soạn response cho GROUP_A/B. STUB."""

    async def advise_node(state: LabTriageState) -> LabTriageState:
        logger.info("lab_triage.advise_stub", triage_group=state.triage_group)
        msg = (
            "Kết quả xét nghiệm của bạn trong giới hạn bình thường."
            if state.triage_group == "GROUP_A"
            else "Kết quả có một số chỉ số cần bác sĩ xem xét. Vui lòng chờ xác nhận."
        )
        return state.model_copy(
            update={
                "response_to_patient": msg,
                "step": LabTriageStep.DONE,
                "turn_count": state.turn_count + 1,
            }
        )

    return advise_node


def make_hard_block_node(pool):
    """Node: GROUP_C — HARD BLOCK, không sinh response cho BN, escalate BS."""

    async def hard_block_node(state: LabTriageState) -> LabTriageState:
        logger.warning(
            "lab_triage.hard_block",
            lab_result_id=str(state.lab_result_id),
            triage_group=state.triage_group,
        )
        return state.model_copy(
            update={
                "response_to_patient": None,  # HARD BLOCK — không gửi BN
                "escalation_note": (
                    f"[URGENT] Kết quả GROUP_C lab_result_id={state.lab_result_id}. "
                    "Yêu cầu bác sĩ xem xét ngay."
                ),
                "requires_doctor_review": True,
                "step": LabTriageStep.DONE,
                "turn_count": state.turn_count + 1,
            }
        )

    return hard_block_node
