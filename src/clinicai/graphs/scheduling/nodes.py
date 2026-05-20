"""P9.1-01 skeleton — logic thật ở P9.1-02 (conversation) và P9.1-03 (tool wire)."""

from __future__ import annotations

import structlog

from clinicai.graphs.scheduling.state import SchedulingState

logger = structlog.get_logger(__name__)


async def ask_date_node(state: SchedulingState) -> dict:
    logger.info("scheduling.ask_date", turn=state.get("turn_count", 0))
    return {
        "step": "ask_time",
        "response": "Dạ chị muốn đặt lịch khám ngày nào ạ? (vd: 25/05 hoặc 'mai')",
        "handled_by": "scheduling_subgraph",
    }


async def ask_time_node(state: SchedulingState) -> dict:
    logger.info("scheduling.ask_time", turn=state.get("turn_count", 0))
    return {
        "step": "find_doctor",
        "response": "Chị mong muốn khung giờ sáng hay chiều ạ?",
        "handled_by": "scheduling_subgraph",
    }


async def find_doctor_node(state: SchedulingState) -> dict:
    logger.info("scheduling.find_doctor", turn=state.get("turn_count", 0))
    return {
        "step": "confirm",
        "response": "[STUB] Em đang tra cứu bác sĩ phù hợp...",
        "handled_by": "scheduling_subgraph",
    }
