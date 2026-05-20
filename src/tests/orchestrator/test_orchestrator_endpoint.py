import pytest
from httpx import ASGITransport, AsyncClient

from clinicai.main import app


@pytest.mark.asyncio
async def test_chat_endpoint_scheduling():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/orchestrator/chat",
            json={"user_message": "đặt lịch khám"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["route"] == "scheduling"
    assert data["error"] is None
    assert data["trace_id"] is not None
