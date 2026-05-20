from typing import Optional

from langgraph.graph import END, START, StateGraph

from clinicai.graphs.scheduling.nodes import (
    ask_date_node,
    ask_time_node,
    confirm_node,
    make_find_doctor_node,
)
from clinicai.graphs.scheduling.state import SchedulingState

_VALID_STEPS: set[str] = {"ask_date", "ask_time", "find_doctor", "confirm"}

_MARKER = "scheduling_subgraph"


def route_by_step(state: SchedulingState) -> str:
    """Map state.step → entry node name. step='done' → END."""
    step = state.get("step", "ask_date")
    if step == "done":
        return "__end__"
    return step if step in _VALID_STEPS else "ask_date"


def _make_no_pool_stub_find_doctor():
    """Backward-compat stub khi pool=None (T-P9.1-02 behavior)."""

    async def find_doctor_node(state: SchedulingState) -> dict:
        turn = state.get("turn_count", 0)
        return {
            "step": "confirm",
            "candidate_doctors": [],
            "response": (
                f"[STUB-no-pool] Đã ghi nhận ngày {state.get('preferred_date')} "
                f"khung {state.get('preferred_time')}. Xác nhận (có/không)?"
            ),
            "handled_by": _MARKER,
            "turn_count": turn + 1,
        }

    return find_doctor_node


def build_scheduling_subgraph(pool: Optional[object] = None):
    """Build scheduling sub-graph với optional asyncpg pool injection.

    - pool=None      → find_doctor_node là stub fallback (giữ test P9.1-02)
    - pool given     → make_find_doctor_node(pool) wire tool thật
    P9.1-04 sẽ luôn truyền pool thật từ orchestrator lifespan.
    """
    find_doctor = (
        make_find_doctor_node(pool)
        if pool is not None
        else _make_no_pool_stub_find_doctor()
    )

    g = StateGraph(SchedulingState)
    g.add_node("ask_date", ask_date_node)
    g.add_node("ask_time", ask_time_node)
    g.add_node("find_doctor", find_doctor)
    g.add_node("confirm", confirm_node)

    g.add_conditional_edges(
        START,
        route_by_step,
        {
            "ask_date": "ask_date",
            "ask_time": "ask_time",
            "find_doctor": "find_doctor",
            "confirm": "confirm",
            "__end__": END,
        },
    )

    for node_name in ("ask_date", "ask_time", "find_doctor", "confirm"):
        g.add_edge(node_name, END)

    return g.compile()
