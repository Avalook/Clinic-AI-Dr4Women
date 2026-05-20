from typing import Optional
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from clinicai.orchestrator.service import OrchestratorService

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])
_service = OrchestratorService()  # singleton skeleton; T-P8-02 → DI lifespan


class ChatInput(BaseModel):
    user_message: str
    patient_id: Optional[UUID] = None
    trace_id: Optional[UUID] = None
    thread_id: Optional[str] = None


class ChatOutput(BaseModel):
    trace_id: UUID
    route: Optional[str] = None
    response: Optional[str] = None
    error: Optional[str] = None


@router.post("/chat", response_model=ChatOutput)
async def chat(input: ChatInput) -> ChatOutput:
    """Debug endpoint. Phase 9.0 → real LLM dispatch."""
    result = await _service.chat(
        user_message=input.user_message,
        patient_id=input.patient_id,
        trace_id=input.trace_id,
        thread_id=input.thread_id,
    )
    return ChatOutput(**result)
