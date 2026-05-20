"""Slot-filling conversation nodes (rule-based parsers).

P9.1-03 sẽ wire find_oncall_staff tool vào find_doctor_node.
"""

from __future__ import annotations

import structlog

from clinicai.graphs.scheduling.parsers import (
    parse_date,
    parse_time_slot,
    parse_yes_no,
)
from clinicai.graphs.scheduling.state import SchedulingState

logger = structlog.get_logger(__name__)

_MARKER = "scheduling_subgraph"


async def ask_date_node(state: SchedulingState) -> dict:
    msg = state.get("user_message", "")
    turn = state.get("turn_count", 0)
    logger.info("scheduling.ask_date", turn=turn)

    if not state.get("preferred_date"):
        parsed = parse_date(msg)
        if parsed:
            return {
                "preferred_date": parsed,
                "step": "ask_time",
                "response": (
                    f"Dạ em đã ghi nhận ngày {parsed}. "
                    "Chị muốn khung giờ sáng, chiều hay tối ạ?"
                ),
                "handled_by": _MARKER,
                "turn_count": turn + 1,
            }
        if turn == 0:
            return {
                "step": "ask_date",
                "response": (
                    "Dạ em hỗ trợ chị đặt lịch khám. "
                    "Chị muốn khám vào ngày nào ạ? (vd: 25/05 hoặc 'mai')"
                ),
                "handled_by": _MARKER,
                "turn_count": 1,
            }
        return {
            "step": "ask_date",
            "response": (
                "Dạ em chưa nhận diện được ngày. "
                "Chị vui lòng nhập lại theo dạng dd/mm hoặc nói 'mai', 'thứ 5' ạ."
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }

    return {"step": "ask_time"}


async def ask_time_node(state: SchedulingState) -> dict:
    msg = state.get("user_message", "")
    turn = state.get("turn_count", 0)
    logger.info("scheduling.ask_time", turn=turn)

    parsed = parse_time_slot(msg)
    if parsed:
        return {
            "preferred_time": parsed,
            "step": "find_doctor",
            "response": (
                f"Dạ em đã ghi nhận khung {parsed}. Em đang tra cứu bác sĩ phù hợp..."
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }
    return {
        "step": "ask_time",
        "response": "Dạ chị vui lòng cho em biết khung sáng, chiều hay tối ạ?",
        "handled_by": _MARKER,
        "turn_count": turn + 1,
    }


async def find_doctor_node(state: SchedulingState) -> dict:
    """P9.1-02 stub — P9.1-03 sẽ wire find_oncall_staff với pool injection."""
    turn = state.get("turn_count", 0)
    logger.info("scheduling.find_doctor", turn=turn)
    return {
        "step": "confirm",
        "candidate_doctors": [],
        "response": (
            f"[STUB-P9.1-02] Em đã ghi nhận yêu cầu ngày "
            f"{state.get('preferred_date')} khung {state.get('preferred_time')}. "
            "Chị xác nhận đặt lịch (có/không)?"
        ),
        "handled_by": _MARKER,
        "turn_count": turn + 1,
    }


async def confirm_node(state: SchedulingState) -> dict:
    msg = state.get("user_message", "")
    turn = state.get("turn_count", 0)
    decision = parse_yes_no(msg)
    logger.info("scheduling.confirm", turn=turn, decision=decision)

    if decision is True:
        return {
            "confirmed": True,
            "step": "done",
            "response": (
                f"Dạ em đã đặt lịch cho chị ngày {state.get('preferred_date')} "
                f"khung {state.get('preferred_time')}. "
                "Em sẽ nhắn xác nhận chi tiết sau ạ."
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }
    if decision is False:
        return {
            "confirmed": False,
            "step": "done",
            "response": (
                "Dạ em đã hủy yêu cầu đặt lịch. Chị cần em hỗ trợ gì khác không ạ?"
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }
    return {
        "step": "confirm",
        "response": "Dạ chị xác nhận giúp em: có hay không ạ?",
        "handled_by": _MARKER,
        "turn_count": turn + 1,
    }
