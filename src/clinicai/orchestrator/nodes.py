import structlog

from clinicai.orchestrator.state import OrchestratorState

logger = structlog.get_logger(__name__)


async def classify_intent_node(state: OrchestratorState) -> dict:
    """Mock classifier. Phase 9.0 → LLM Haiku thật."""
    msg = state.get("user_message", "").lower()
    trace_id = state.get("trace_id")

    if any(kw in msg for kw in ["lịch", "hẹn", "appointment", "book"]):
        route = "scheduling"
    elif any(kw in msg for kw in ["xét nghiệm", "lab", "kết quả"]):
        route = "lab"
    elif any(kw in msg for kw in ["zalo", "nhắn", "thông báo"]):
        route = "communication"
    elif msg.strip() == "":
        route = "unknown"
    else:
        route = "general"

    logger.info("classify_intent", trace_id=str(trace_id), route=route)
    return {"route": route}


async def respond_node(state: OrchestratorState) -> dict:
    """Mock responder. Phase 9.0 → LLM Sonnet + sub-graph dispatch."""
    route = state.get("route", "unknown")
    trace_id = state.get("trace_id")

    templates = {
        "scheduling": "Đã nhận yêu cầu về lịch hẹn. (Phase 9.2 xử lý thật)",
        "lab": "Đã nhận yêu cầu về xét nghiệm. (Phase 9.4 xử lý thật)",
        "communication": "Đã nhận yêu cầu nhắn tin. (Phase 9.1 xử lý thật)",
        "general": "Đã nhận tin nhắn chung. (Phase 9.0 route thật)",
        "unknown": "Tin nhắn trống hoặc không hiểu.",
    }
    response = templates.get(route, "Lỗi: route không xác định.")
    logger.info("respond_node", trace_id=str(trace_id), route=route)
    return {"response": response}
