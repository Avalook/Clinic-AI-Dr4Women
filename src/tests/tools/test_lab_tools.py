"""Unit tests for the lab.classify stub tool."""

from __future__ import annotations

from uuid import uuid4

import pytest

from clinicai.tools._common.context import new_trace
from clinicai.tools.lab.classify import (
    ClassifyLabInput,
    classify_lab_result,
)


@pytest.mark.asyncio
async def test_classify_returns_pending_stub() -> None:
    """Stub must mark every input as PENDING."""
    inp = ClassifyLabInput(lab_result_id=uuid4(), ctx=new_trace())

    out = await classify_lab_result(inp)

    assert out.classification == "PENDING"
    assert out.stub is True
    assert out.lab_result_id == inp.lab_result_id


@pytest.mark.asyncio
async def test_classify_no_doctor_review_in_stub() -> None:
    """Stub must not escalate to doctor review (no GROUP_C inference yet)."""
    inp = ClassifyLabInput(lab_result_id=uuid4(), ctx=new_trace())

    out = await classify_lab_result(inp)

    assert out.requires_doctor_review is False


@pytest.mark.asyncio
async def test_classify_trace_id_propagated() -> None:
    """Output trace_id must equal input ctx trace_id."""
    inp = ClassifyLabInput(lab_result_id=uuid4(), ctx=new_trace())

    out = await classify_lab_result(inp)

    assert out.trace_id == inp.ctx.trace_id
