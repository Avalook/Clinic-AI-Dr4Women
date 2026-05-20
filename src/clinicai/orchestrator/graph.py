from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from clinicai.orchestrator.nodes import classify_intent_node, respond_node
from clinicai.orchestrator.state import OrchestratorState


def build_orchestrator_graph(checkpointer: BaseCheckpointSaver | None = None):
    """Factory: swap MemorySaver↔PostgresSaver qua param (T-P8-02 dùng)."""
    if checkpointer is None:
        checkpointer = MemorySaver()
    graph = StateGraph(OrchestratorState)
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("respond", respond_node)
    graph.add_edge(START, "classify_intent")
    graph.add_edge("classify_intent", "respond")
    graph.add_edge("respond", END)
    return graph.compile(checkpointer=checkpointer)
