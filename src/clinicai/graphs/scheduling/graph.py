from langgraph.graph import END, START, StateGraph

from clinicai.graphs.scheduling.nodes import (
    ask_date_node,
    ask_time_node,
    find_doctor_node,
)
from clinicai.graphs.scheduling.state import SchedulingState


def build_scheduling_subgraph():
    """Linear flow tạm; P9.1-02 sẽ đổi sang conditional + slot-filling."""
    g = StateGraph(SchedulingState)
    g.add_node("ask_date", ask_date_node)
    g.add_node("ask_time", ask_time_node)
    g.add_node("find_doctor", find_doctor_node)
    g.add_edge(START, "ask_date")
    g.add_edge("ask_date", "ask_time")
    g.add_edge("ask_time", "find_doctor")
    g.add_edge("find_doctor", END)
    return g.compile()
