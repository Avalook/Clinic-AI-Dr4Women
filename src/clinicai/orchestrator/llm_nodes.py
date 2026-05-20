"""LLM-powered nodes. Closure factory pattern: inject AnthropicClient vào graph.

classify_intent_llm_node uses Haiku 4.5 (gateway tier).
Fallback rule-based on parse error / API failure.
"""

from __future__ import annotations

import json
from typing import Awaitable, Callable

import structlog

from clinicai.llm.anthropic_client import AnthropicClient
from clinicai.orchestrator.nodes import classify_intent_rule_based
from clinicai.orchestrator.state import OrchestratorState

logger = structlog.get_logger(__name__)

VALID_ROUTES: set[str] = {"scheduling", "lab", "communication", "general", "unknown"}

CLASSIFY_SYSTEM_PROMPT = """\
Bạn là bộ phân loại ý định cho hệ thống AI phòng khám sản phụ khoa Dr4Women.
Phân loại tin nhắn bệnh nhân vào ĐÚNG MỘT trong 5 route sau:

- "scheduling": Đặt/hủy/đổi lịch hẹn khám, hỏi giờ khám, đăng ký khám
- "lab": Hỏi kết quả xét nghiệm, yêu cầu xét nghiệm, hỏi quy trình xét nghiệm
- "communication": Yêu cầu nhắn tin Zalo, gửi thông báo, nhắc nhở
- "general": Tin nhắn chung (chào hỏi, hỏi thông tin chung, tư vấn ngoài 3 nhóm trên)
- "unknown": Tin nhắn trống, không hiểu được, hoặc spam

CHỈ trả về JSON object đúng format sau, KHÔNG markdown, KHÔNG text khác:
{"route": "<one_of_5>", "confidence": <0.0-1.0>, "reasoning": "<vietnamese 1 sentence>"}

Ví dụ:
Input: "Tôi muốn đặt lịch khám ngày mai"
Output: {"route": "scheduling", "confidence": 0.98, "reasoning": "Yêu cầu đặt lịch"}

Input: "Cho tôi xem kết quả siêu âm hôm qua"
Output: {"route": "lab", "confidence": 0.95, "reasoning": "Hỏi kết quả siêu âm"}

Input: "Xin chào bác sĩ"
Output: {"route": "general", "confidence": 0.9, "reasoning": "Lời chào chung"}
"""


def _strip_markdown_fence(text: str) -> str:
    """Strip ```json ... ``` fence nếu Haiku lỡ wrap."""
    text = text.strip()
    if not text.startswith("```"):
        return text
    parts = text.split("```")
    if len(parts) < 2:
        return text
    inner = parts[1]
    if inner.startswith("json"):
        inner = inner[4:]
    return inner.strip()


def make_classify_intent_llm_node(
    llm: AnthropicClient,
) -> Callable[[OrchestratorState], Awaitable[dict]]:
    """Factory tạo node có inject AnthropicClient qua closure."""

    async def classify_intent_llm_node(state: OrchestratorState) -> dict:
        msg = state.get("user_message", "")
        trace_id = state.get("trace_id")

        if not msg or not msg.strip():
            logger.info("classify_intent_empty_message", trace_id=str(trace_id))
            return {"route": "unknown"}

        resp = None
        try:
            resp = await llm.chat(
                messages=[{"role": "user", "content": msg}],
                tier="gateway",
                system=CLASSIFY_SYSTEM_PROMPT,
                max_tokens=200,
                temperature=0.0,
                trace_id=trace_id,
            )

            text = _strip_markdown_fence(resp.text)
            parsed = json.loads(text)
            route_raw = str(parsed.get("route", "")).strip().lower()

            if route_raw not in VALID_ROUTES:
                raise ValueError(f"Invalid route from LLM: {route_raw!r}")

            confidence = float(parsed.get("confidence", 0.0))
            reasoning = parsed.get("reasoning", "")

            logger.info(
                "classify_intent_llm",
                trace_id=str(trace_id),
                route=route_raw,
                confidence=confidence,
                reasoning=reasoning,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
                latency_ms=resp.latency_ms,
            )
            return {"route": route_raw}

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            fallback_route = classify_intent_rule_based(msg)
            logger.warning(
                "classify_intent_llm_parse_failed_fallback",
                trace_id=str(trace_id),
                error=str(e),
                raw_text=(resp.text[:200] if resp is not None else None),
                fallback_route=fallback_route,
            )
            return {"route": fallback_route}

        except Exception as e:
            fallback_route = classify_intent_rule_based(msg)
            logger.error(
                "classify_intent_llm_api_failed_fallback",
                trace_id=str(trace_id),
                error=str(e),
                error_type=type(e).__name__,
                fallback_route=fallback_route,
            )
            return {"route": fallback_route}

    return classify_intent_llm_node
