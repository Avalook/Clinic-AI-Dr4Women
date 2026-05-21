"""FastAPI router mounting the tools layer for OpenAPI documentation.

These endpoints are NOT production-grade orchestration. They exist so graph
developers can read OpenAPI /docs and exercise each tool with curl. Real
clients of the tools layer call the Python functions directly.
"""

from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from clinicai.core.database import get_db_pool
from clinicai.event_bus.publisher import IEventPublisher, MockEventPublisher
from clinicai.tools.communication.send_zalo import (
    SendZaloInput,
    SendZaloOutput,
    send_zalo_message,
)
from clinicai.tools.event_log.append import (
    AppendEventInput,
    AppendEventOutput,
    append_event,
)
from clinicai.tools.kb.read_policy import (
    PolicyOutput,
    ReadPolicyInput,
    read_policy,
)

# TODO(T-P9.2-04): re-wire /lab/classify endpoint after sub-graph wiring.
# Stub `classify_lab_result(input)` was replaced in T-P9.2-03 by
# `classify_lab_result(row, gateway, trace) -> ClassifyResult`. The new
# signature needs an injected AnthropicClient + pre-fetched LabResultRow,
# which the dev/doc router cannot provide on its own. Kept commented to
# avoid silently exposing a broken endpoint; old stub preserved at
# tools/lab/_classify_stub_backup.py for reference.
# from clinicai.tools.lab.classify import (
#     ClassifyLabInput,
#     LabClassificationOutput,
#     classify_lab_result,
# )
from clinicai.tools.patient.get_summary import (
    GetPatientSummaryInput,
    PatientSummaryOutput,
    get_patient_summary,
)
from clinicai.tools.scheduling.find_oncall import (
    FindOncallInput,
    OncallStaffOutput,
    find_oncall_staff,
)
from clinicai.tools.task.create import (
    CreateTaskInput,
    CreateTaskOutput,
    create_task,
)

router = APIRouter(prefix="/tools", tags=["tools"])

# Module-level publisher used by /tools/event-log/append. MockEventPublisher
# is intentional: this router is a dev/doc surface, not the production hot
# path — real publishing is wired in worker entrypoints.
_PUBLISHER: IEventPublisher = MockEventPublisher()


def get_event_publisher() -> IEventPublisher:
    """FastAPI dependency: yields the dev-mode publisher."""
    return _PUBLISHER


@router.post("/patient/get-summary", response_model=PatientSummaryOutput)
async def _patient_get_summary(
    input: GetPatientSummaryInput,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> PatientSummaryOutput:
    return await get_patient_summary(input, pool)


@router.post("/scheduling/find-oncall", response_model=OncallStaffOutput)
async def _scheduling_find_oncall(
    input: FindOncallInput,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> OncallStaffOutput:
    return await find_oncall_staff(input, pool)


@router.post("/event-log/append", response_model=AppendEventOutput)
async def _event_log_append(
    input: AppendEventInput,
    pool: asyncpg.Pool = Depends(get_db_pool),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> AppendEventOutput:
    return await append_event(input, pool, publisher)


@router.post("/kb/read-policy", response_model=PolicyOutput)
async def _kb_read_policy(
    input: ReadPolicyInput,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> PolicyOutput:
    return await read_policy(input, pool)


@router.post("/communication/send-zalo", response_model=SendZaloOutput)
async def _communication_send_zalo(input: SendZaloInput) -> SendZaloOutput:
    return await send_zalo_message(input)


# TODO(T-P9.2-04): restore /lab/classify endpoint with the real signature
# (needs AnthropicClient dependency + LabResultRow lookup before calling
# classify_lab_result). See import block above for context.
# @router.post("/lab/classify", response_model=LabClassificationOutput)
# async def _lab_classify(input: ClassifyLabInput) -> LabClassificationOutput:
#     return await classify_lab_result(input)


@router.post("/task/create", response_model=CreateTaskOutput)
async def _task_create(
    input: CreateTaskInput,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> CreateTaskOutput:
    return await create_task(input, pool)
