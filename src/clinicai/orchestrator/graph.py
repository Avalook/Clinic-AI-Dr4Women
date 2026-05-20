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
    graph.add_edge(START, "classify_intent")
    graph.add_edge("classify_intent", "respond")
    graph.add_edge("respond", END)
    return graph.compile(checkpointer=checkpointer)
