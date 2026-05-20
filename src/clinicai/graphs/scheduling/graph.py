from langgraph.graph import END, START, StateGraph

from clinicai.graphs.scheduling.nodes import (
    ask_date_node,
    ask_time_node,
    confirm_node,
    find_doctor_node,
)
from clinicai.graphs.scheduling.state import SchedulingState

_VALID_STEPS: set[str] = {"ask_date", "ask_time", "find_doctor", "confirm"}


def route_by_step(state: SchedulingState) -> str:
    """Map state.step → entry node name. step='done' → END."""
    step = state.get("step", "ask_date")
    if step == "done":
        return "__end__"
    return step if step in _VALID_STEPS else "ask_date"


def build_scheduling_subgraph():
    """Conditional routing from START. Each node → END (single-turn flow)."""
    g = StateGraph(SchedulingState)
    g.add_node("ask_date", ask_date_node)
    g.add_node("ask_time", ask_time_node)
    g.add_node("find_doctor", find_doctor_node)
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
