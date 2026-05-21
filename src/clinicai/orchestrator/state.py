from typing import Any, Literal, NotRequired, Optional, TypedDict
from uuid import UUID

RouteType = Literal["scheduling", "lab", "communication", "general", "unknown"]


class OrchestratorState(TypedDict, total=False):
    """Shared state across orchestrator + sub-graph nodes.

    Scheduling-specific fields are declared here (NotRequired) so the parent
    state can share keys with SchedulingState when the compiled scheduling
    sub-graph is added as a node. Without these fields LangGraph filters them
    out at the sub-graph boundary and the slot-filling conversation loses
    context across turns.
    """

    trace_id: UUID
    user_message: str
    patient_id: Optional[UUID]
    route: RouteType
    response: str
    error: Optional[str]
    handled_by: NotRequired[str | None]
    # ----- scheduling sub-graph fields (mirror SchedulingState) -----
    step: NotRequired[str]
    turn_count: NotRequired[int]
    preferred_date: NotRequired[str | None]
    preferred_time: NotRequired[str | None]
    preferred_doctor: NotRequired[str | None]
    candidate_doctors: NotRequired[list[dict[str, Any]]]
    confirmed: NotRequired[bool]
