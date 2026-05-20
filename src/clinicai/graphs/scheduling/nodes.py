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


def make_find_doctor_node(pool):
    """Closure factory: bind asyncpg pool vào find_doctor_node.

    P9.1-03 NOTE: tool `find_oncall_staff` yêu cầu `work_session_id: UUID` —
    sub-graph chưa có resolver từ (date, time_slot) → work_session_id (P9.1-04 sẽ thêm).
    Hiện tại dùng placeholder uuid4() để satisfy schema; tests mock toàn bộ.
    """
    from uuid import uuid4

    from clinicai.tools._common.context import TraceContext

    async def find_doctor_node(state: SchedulingState) -> dict:
        from clinicai.tools.scheduling.find_oncall import (
            FindOncallInput,
            find_oncall_staff,
        )

        preferred_date = state.get("preferred_date")
        preferred_time = state.get("preferred_time")
        turn = state.get("turn_count", 0)
        logger.info(
            "scheduling.find_doctor",
            turn=turn,
            date=preferred_date,
            time=preferred_time,
        )

        ctx = TraceContext(trace_id=uuid4())
        tool_input = FindOncallInput(
            work_session_id=uuid4(),
            ctx=ctx,
        )

        try:
            result = await find_oncall_staff(tool_input, pool)
        except Exception as e:
            logger.error(
                "scheduling.find_doctor_tool_failed",
                error=str(e),
                error_type=type(e).__name__,
            )
            return {
                "step": "confirm",
                "candidate_doctors": [],
                "response": (
                    "Dạ em chưa tra cứu được lịch bác sĩ. "
                    "Chị có muốn em thử lại hoặc chuyển nhân viên tư vấn không ạ?"
                ),
                "handled_by": _MARKER,
                "turn_count": turn + 1,
            }

        all_staff = getattr(result, "on_duty_staff", []) or []
        doctors = [s for s in all_staff if str(s.get("role", "")).upper() == "DOCTOR"]

        if not doctors:
            return {
                "step": "ask_date",
                "candidate_doctors": [],
                "preferred_date": None,
                "response": (
                    f"Dạ ngày {preferred_date} khung {preferred_time} "
                    "không có bác sĩ rảnh. Chị chọn ngày khác giúp em ạ."
                ),
                "handled_by": _MARKER,
                "turn_count": turn + 1,
            }

        top = doctors[0]
        doctor_name = top.get("full_name") or top.get("name") or "bác sĩ trực"
        return {
            "step": "confirm",
            "candidate_doctors": doctors,
            "preferred_doctor": doctor_name,
            "response": (
                f"Dạ em tìm thấy {doctor_name} có thể khám ngày {preferred_date} "
                f"khung {preferred_time}. Chị xác nhận đặt lịch (có/không)?"
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }

    return find_doctor_node


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
