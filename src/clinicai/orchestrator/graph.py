from typing import Optional

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from clinicai.llm.anthropic_client import AnthropicClient
from clinicai.orchestrator.llm_nodes import (
    make_classify_intent_llm_node,
    make_respond_node_llm,
)
from clinicai.orchestrator.nodes import classify_intent_node, respond_node
from clinicai.orchestrator.state import OrchestratorState
from clinicai.orchestrator.stubs import (
    communication_stub_node,
    lab_triage_stub_node,
    previsit_brief_stub_node,
    scheduling_stub_node,
    task_manager_stub_node,
)

_VALID_ROUTES: set[str] = {
    "scheduling",
    "lab",
    "communication",
    "task",
    "previsit",
    "general",
}


def route_by_intent(state: OrchestratorState) -> str:
    """Map classify route → conditional edge target. Fallback 'general'."""
    route = state.get("route", "general")
    if route in _VALID_ROUTES:
        return route
    return "general"


def build_orchestrator_graph(
    checkpointer: Optional[BaseCheckpointSaver] = None,
    llm_client: Optional[AnthropicClient] = None,
    use_llm_respond: bool = True,
):
    """Factory.

    - checkpointer=None → MemorySaver
    - llm_client=None   → rule-based classify + template respond (offline)
    - llm_client given  → Haiku classify; respond uses Sonnet if use_llm_respond,
                          else template respond_node.

    Conditional edges: classify → 5 sub-graph stubs OR respond (general).
    Each stub → END directly (no loop back to respond).
    """
    if checkpointer is None:
        checkpointer = MemorySaver()

    classify_node = (
        classify_intent_node
        if llm_client is None
        else make_classify_intent_llm_node(llm_client)
    )

    respond = (
        make_respond_node_llm(llm_client)
        if (llm_client is not None and use_llm_respond)
        else respond_node
    )

    graph = StateGraph(OrchestratorState)
    graph.add_node("classify_intent", classify_node)
    graph.add_node("respond", respond)
    graph.add_node("scheduling_stub", scheduling_stub_node)
    graph.add_node("lab_triage_stub", lab_triage_stub_node)
    graph.add_node("communication_stub", communication_stub_node)
    graph.add_node("task_manager_stub", task_manager_stub_node)
    graph.add_node("previsit_brief_stub", previsit_brief_stub_node)

    graph.add_edge(START, "classify_intent")
    graph.add_conditional_edges(
        "classify_intent",
        route_by_intent,
        {
            "scheduling": "scheduling_stub",
            "lab": "lab_triage_stub",
            "communication": "communication_stub",
            "task": "task_manager_stub",
            "previsit": "previsit_brief_stub",
            "general": "respond",
        },
    )

    graph.add_edge("scheduling_stub", END)
    graph.add_edge("lab_triage_stub", END)
    graph.add_edge("communication_stub", END)
    graph.add_edge("task_manager_stub", END)
    graph.add_edge("previsit_brief_stub", END)
    graph.add_edge("respond", END)

    return graph.compile(checkpointer=checkpointer)
