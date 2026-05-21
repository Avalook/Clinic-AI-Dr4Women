"""Lab triage sub-graph builder — Phase 9.2."""

from __future__ import annotations

from uuid import UUID

import asyncpg
from langgraph.graph import END, StateGraph

from clinicai.graphs.lab_triage.nodes import (
    make_advise_node,
    make_classify_node,
    make_hard_block_node,
    make_receive_node,
)
from clinicai.graphs.lab_triage.state import LabTriageState


def _route_after_classify(state: LabTriageState) -> str:
    """Route sau classify: GROUP_C → hard_block, còn lại → advise."""
    if state.triage_group == "GROUP_C":
        return "hard_block"
    return "advise"


def build_lab_triage_subgraph(pool: asyncpg.Pool, location_id: UUID):
    """Build compiled lab_triage sub-graph.

    Pattern: closure factory inject pool (TEMPLATE P9.x).
    Nodes stub ở P9.2-01, real classify ở P9.2-03.
    """
    sg = StateGraph(LabTriageState)

    sg.add_node("receive", make_receive_node())
    sg.add_node("classify", make_classify_node(pool))
    sg.add_node("advise", make_advise_node(pool))
    sg.add_node("hard_block", make_hard_block_node(pool))

    sg.set_entry_point("receive")

    sg.add_edge("receive", "classify")
    sg.add_conditional_edges(
        "classify",
        _route_after_classify,
        {"advise": "advise", "hard_block": "hard_block"},
    )
    sg.add_edge("advise", END)
    sg.add_edge("hard_block", END)

    return sg.compile()
