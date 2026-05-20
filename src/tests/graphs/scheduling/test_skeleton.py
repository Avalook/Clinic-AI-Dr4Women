import pytest

from clinicai.graphs.scheduling import SchedulingState, build_scheduling_subgraph
from clinicai.graphs.scheduling.nodes import (
    ask_date_node,
    ask_time_node,
    find_doctor_node,
)


def test_build_scheduling_subgraph_compiles():
    graph = build_scheduling_subgraph()
    assert graph is not None
    node_names = set(graph.get_graph().nodes.keys())
    assert {"ask_date", "ask_time", "find_doctor"}.issubset(node_names)


@pytest.mark.asyncio
async def test_ask_date_node_returns_correct_step():
    state: SchedulingState = {"user_message": "đặt lịch", "turn_count": 0}
    result = await ask_date_node(state)
    assert result["step"] == "ask_time"
    assert "ngày nào" in result["response"]
    assert result["handled_by"] == "scheduling_subgraph"


@pytest.mark.asyncio
async def test_ask_time_node_returns_correct_step():
    state: SchedulingState = {"user_message": "mai", "turn_count": 1}
    result = await ask_time_node(state)
    assert result["step"] == "find_doctor"
    assert ("sáng" in result["response"]) or ("chiều" in result["response"])
    assert result["handled_by"] == "scheduling_subgraph"


@pytest.mark.asyncio
async def test_find_doctor_node_returns_stub():
    state: SchedulingState = {"user_message": "sáng", "turn_count": 2}
    result = await find_doctor_node(state)
    assert result["step"] == "confirm"
    assert "[STUB]" in result["response"]
    assert result["handled_by"] == "scheduling_subgraph"


@pytest.mark.asyncio
async def test_subgraph_full_linear_invocation():
    graph = build_scheduling_subgraph()
    result = await graph.ainvoke(
        {
            "user_message": "đặt lịch",
            "turn_count": 0,
            "step": "ask_date",
            "response": "",
        }
    )
    assert result["step"] == "confirm"
    assert result["handled_by"] == "scheduling_subgraph"
