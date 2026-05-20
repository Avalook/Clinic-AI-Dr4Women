"""Tool: task.create — STUB wrapper around TaskService.create_task_stub."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal
from uuid import UUID

import structlog
from pydantic import BaseModel

from clinicai.services.task_service import TaskService
from clinicai.tools._common.context import TraceContext

if TYPE_CHECKING:
    import asyncpg

logger = structlog.get_logger()

TaskType = Literal[
    "LAB_REVIEW",
    "LAB_NOTIFY",
    "SLOT_FILL",
    "APPOINTMENT_CONFIRM",
    "INTAKE_FOLLOWUP",
    "PRESCRIPTION_DISPENSE",
    "PATIENT_CALLBACK",
]


class CreateTaskInput(BaseModel):
    """Input schema for task.create. task_type is constrained to known kinds."""

    task_type: TaskType
    entity_id: UUID
    entity_type: str
    ctx: TraceContext


class CreateTaskOutput(BaseModel):
    """Returned task identity + status."""

    task_id: UUID
    task_type: str
    status: str
    stub: bool
    trace_id: UUID


async def create_task(
    input: CreateTaskInput,
    pool: asyncpg.Pool,
) -> CreateTaskOutput:
    """Thin wrapper → TaskService.create_task_stub. Phase 9.3 wires real DB."""
    logger.info(
        "tool.task.create",
        task_type=input.task_type,
        entity_id=str(input.entity_id),
        trace_id=str(input.ctx.trace_id),
    )

    service = TaskService(pool)
    task = await service.create_task_stub(
        task_type=input.task_type,
        entity_id=input.entity_id,
        ctx={"trace_id": str(input.ctx.trace_id)},
    )

    return CreateTaskOutput(
        task_id=task["task_id"],
        task_type=task["task_type"],
        status=task["status"],
        stub=task["stub"],
        trace_id=input.ctx.trace_id,
    )
