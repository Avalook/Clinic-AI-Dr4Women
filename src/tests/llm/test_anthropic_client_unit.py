from unittest.mock import AsyncMock, MagicMock

import pytest

from clinicai.llm.anthropic_client import AnthropicClient, LLMResponse
from clinicai.llm.models import GATEWAY_MODEL, MAIN_BRAIN_MODEL


@pytest.mark.asyncio
async def test_chat_returns_llm_response(monkeypatch):
    """Mock SDK, verify wrapper extract text + usage đúng."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-fake")
    client = AnthropicClient()

    fake_block = MagicMock()
    fake_block.type = "text"
    fake_block.text = "Hello world"
    fake_resp = MagicMock()
    fake_resp.content = [fake_block]
    fake_resp.model = GATEWAY_MODEL
    fake_resp.usage = MagicMock(input_tokens=10, output_tokens=5)
    fake_resp.stop_reason = "end_turn"

    client._client.messages.create = AsyncMock(return_value=fake_resp)

    result = await client.chat(
        messages=[{"role": "user", "content": "Hi"}],
        tier="gateway",
    )

    assert isinstance(result, LLMResponse)
    assert result.text == "Hello world"
    assert result.model == GATEWAY_MODEL
    assert result.input_tokens == 10
    assert result.output_tokens == 5
    assert result.latency_ms >= 0


@pytest.mark.asyncio
async def test_chat_main_brain_tier_uses_sonnet(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-fake")
    client = AnthropicClient()

    fake_block = MagicMock(type="text", text="ok")
    fake_resp = MagicMock(
        content=[fake_block],
        model=MAIN_BRAIN_MODEL,
        usage=MagicMock(input_tokens=1, output_tokens=1),
        stop_reason="end_turn",
    )
    client._client.messages.create = AsyncMock(return_value=fake_resp)

    await client.chat(messages=[{"role": "user", "content": "x"}], tier="main_brain")

    call_kwargs = client._client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == MAIN_BRAIN_MODEL


def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        AnthropicClient()
