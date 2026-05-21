"""Tests for lab_triage sub-graph skeleton (P9.2-01)."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from clinicai.graphs.lab_triage.graph import build_lab_triage_subgraph
from clinicai.graphs.lab_triage.state import LabTriageState, LabTriageStep


@pytest.fixture
def mock_pool() -> MagicMock:
    return MagicMock()


@pytest.fixture
def graph(mock_pool):
    return build_lab_triage_subgraph(pool=mock_pool, location_id=uuid4())


@pytest.mark.asyncio
async def test_group_a_flow_returns_response(graph) -> None:
    """GROUP_A stub: response_to_patient phải có nội dung, step=DONE."""
    state = LabTriageState(lab_result_id=uuid4(), clinic_patient_id=uuid4())
    result = await graph.ainvoke(state)
    assert result["step"] == LabTriageStep.DONE
    assert result["response_to_patient"] is not None
    assert result["triage_group"] == "GROUP_A"


@pytest.mark.asyncio
async def test_missing_lab_result_id_returns_error(graph) -> None:
    """Thiếu lab_result_id → step=DONE, error set."""
    state = LabTriageState()
    result = await graph.ainvoke(state)
    assert result["step"] == LabTriageStep.DONE
    assert result["error"] is not None


@pytest.mark.asyncio
async def test_hard_block_node_directly(mock_pool) -> None:
    """hard_block node: response_to_patient=None, escalation_note set."""
    from clinicai.graphs.lab_triage.nodes import make_hard_block_node

    node = make_hard_block_node(mock_pool)
    state = LabTriageState(
        lab_result_id=uuid4(),
        triage_group="GROUP_C",
        step=LabTriageStep.HARD_BLOCK,
    )
    result = await node(state)
    assert result.response_to_patient is None
    assert result.escalation_note is not None
    assert result.requires_doctor_review is True
    assert result.step == LabTriageStep.DONE


def test_graph_builds_without_error(mock_pool) -> None:
    """build_lab_triage_subgraph không throw exception."""
    g = build_lab_triage_subgraph(pool=mock_pool, location_id=uuid4())
    assert g is not None
