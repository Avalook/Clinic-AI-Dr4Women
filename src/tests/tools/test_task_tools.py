"""Unit tests for the task.create stub tool."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from clinicai.tools._common.context import new_trace
from clinicai.tools.task.create import CreateTaskInput, create_task


@pytest.fixture
def mock_pool() -> MagicMock:
    """Pool is not touched by the stub but the signature requires it."""
    return MagicMock()


@pytest.mark.asyncio
async def test_create_task_returns_uuid(mock_pool: MagicMock) -> None:
    """task_id must be a UUID — caller may persist it as a foreign key."""
    inp = CreateTaskInput(
        task_type="LAB_REVIEW",
        entity_id=uuid4(),
        entity_type="lab_result",
        ctx=new_trace(),
    )

    out = await create_task(inp, mock_pool)

    assert isinstance(out.task_id, UUID)


@pytest.mark.asyncio
async def test_create_task_status_open(mock_pool: MagicMock) -> None:
    """Stub returns OPEN status + stub=True flag."""
    inp = CreateTaskInput(
        task_type="SLOT_FILL",
        entity_id=uuid4(),
        entity_type="appointment",
        ctx=new_trace(),
    )

    out = await create_task(inp, mock_pool)

    assert out.status == "OPEN"
    assert out.stub is True
    assert out.task_type == "SLOT_FILL"


def test_create_task_invalid_type_raises() -> None:
    """Invalid task_type must be rejected at the Pydantic boundary."""
    with pytest.raises(ValidationError):
        CreateTaskInput(
            task_type="INVALID",  # type: ignore[arg-type]
            entity_id=uuid4(),
            entity_type="x",
            ctx=new_trace(),
        )
