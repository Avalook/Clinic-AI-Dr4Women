from typing import Literal, Optional, TypedDict
from uuid import UUID

RouteType = Literal["scheduling", "lab", "communication", "general", "unknown"]


class OrchestratorState(TypedDict, total=False):
    trace_id: UUID
    user_message: str
    patient_id: Optional[UUID]
    route: RouteType
    response: str
    error: Optional[str]
