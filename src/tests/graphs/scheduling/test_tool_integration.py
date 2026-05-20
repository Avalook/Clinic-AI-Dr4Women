"""find_oncall_staff tool integration into scheduling sub-graph.

Tool actual signature: FindOncallInput(work_session_id, ctx) → OncallStaffOutput
(.on_duty_staff list of {staff_id, full_name, role, station}). Tests mock the
tool directly via monkeypatch on the module path used inside the closure.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from clinicai.graphs.scheduling import (
    build_scheduling_subgraph,
    make_find_doctor_node,
)
from clinicai.graphs.scheduling.state import SchedulingState

_TOOL_PATH = "clinicai.tools.scheduling.find_oncall.find_oncall_staff"


def _doctor_dict(name: str = "BS Trần Thị A") -> dict:
    return {
        "staff_id": uuid4(),
        "full_name": name,
        "role": "DOCTOR",
        "station": "OBGYN",
    }


def _mock_tool_output(staff_list: list[dict]) -> MagicMock:
    out = MagicMock()
    out.on_duty_staff = staff_list
    out.doctor_ids = [
        s["staff_id"] for s in staff_list if str(s.get("role", "")).upper() == "DOCTOR"
    ]
    return out


def test_make_find_doctor_node_returns_callable():
    pool = AsyncMock()
    node = make_find_doctor_node(pool)
    assert callable(node)


@pytest.mark.asyncio
async def test_find_doctor_with_candidates_success(monkeypatch):
    staff_list = [_doctor_dict("BS Trần Thị A")]
    monkeypatch.setattr(
        _TOOL_PATH,
        AsyncMock(return_value=_mock_tool_output(staff_list)),
    )

    node = make_find_doctor_node(AsyncMock())
    state: SchedulingState = {
        "preferred_date": "2026-05-25",
        "preferred_time": "morning",
        "turn_count": 2,
    }
    result = await node(state)

    assert result["step"] == "confirm"
    assert result["preferred_doctor"] == "BS Trần Thị A"
    assert "có thể khám" in result["response"]
    assert len(result["candidate_doctors"]) == 1


@pytest.mark.asyncio
async def test_find_doctor_empty_candidates_loops_back(monkeypatch):
    monkeypatch.setattr(
        _TOOL_PATH,
        AsyncMock(return_value=_mock_tool_output([])),
    )

    node = make_find_doctor_node(AsyncMock())
    state: SchedulingState = {
        "preferred_date": "2026-05-25",
        "preferred_time": "morning",
        "turn_count": 2,
    }
    result = await node(state)

    assert result["step"] == "ask_date"
    assert result["preferred_date"] is None
    assert "không có bác sĩ rảnh" in result["response"]


@pytest.mark.asyncio
async def test_find_doctor_tool_exception_fallback(monkeypatch):
    monkeypatch.setattr(
        _TOOL_PATH,
        AsyncMock(side_effect=RuntimeError("DB down")),
    )

    node = make_find_doctor_node(AsyncMock())
    state: SchedulingState = {
        "preferred_date": "2026-05-25",
        "preferred_time": "morning",
        "turn_count": 2,
    }
    # Should NOT raise
    result = await node(state)

    assert result["step"] == "confirm"
    assert result["candidate_doctors"] == []
    assert "chưa tra cứu được" in result["response"]


def test_build_subgraph_with_pool_compiles():
    graph = build_scheduling_subgraph(pool=AsyncMock())
    assert graph is not None
    node_names = set(graph.get_graph().nodes.keys())
    assert {"ask_date", "ask_time", "find_doctor", "confirm"}.issubset(node_names)


@pytest.mark.asyncio
async def test_build_subgraph_no_pool_fallback_stub():
    graph = build_scheduling_subgraph(pool=None)
    initial: SchedulingState = {
        "step": "find_doctor",
        "user_message": "",
        "turn_count": 2,
        "preferred_date": "2026-05-25",
        "preferred_time": "morning",
        "response": "",
    }
    result = await graph.ainvoke(initial)
    assert "[STUB-no-pool]" in result["response"]
