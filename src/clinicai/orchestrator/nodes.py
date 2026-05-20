"""Mock/rule-based nodes — giữ làm fallback khi LLM fail hoặc unit test."""

import structlog

from clinicai.orchestrator.state import OrchestratorState

logger = structlog.get_logger(__name__)


def classify_intent_rule_based(message: str) -> str:
    """Pure function tách ra để LLM node reuse khi fallback."""
    msg = message.lower()
    if any(kw in msg for kw in ["lịch", "hẹn", "appointment", "book"]):
        return "scheduling"
    if any(kw in msg for kw in ["xét nghiệm", "lab", "kết quả"]):
        return "lab"
    if any(kw in msg for kw in ["zalo", "nhắn", "thông báo"]):
        return "communication"
    if msg.strip() == "":
        return "unknown"
    return "general"


async def classify_intent_node(state: OrchestratorState) -> dict:
    """Rule-based fallback node. Dùng khi không có llm_client."""
    msg = state.get("user_message", "")
    route = classify_intent_rule_based(msg)
    logger.info(
        "classify_intent_rule_based",
        trace_id=str(state.get("trace_id")),
        route=route,
    )
    return {"route": route}


async def respond_node(state: OrchestratorState) -> dict:
    """Template responder (giữ nguyên, Phase 9.0 → LLM Sonnet)."""
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
