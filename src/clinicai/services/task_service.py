"""TaskService — STUB Phase 6 ; real impl + migration land in Phase 9.3."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import structlog

if TYPE_CHECKING:
    import asyncpg

logger = structlog.get_logger()


class TaskService:
    """In-memory task creation stub — no DB writes until Phase 9.3 migration."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        # pool is accepted for API symmetry with other services; unused in stub
        self._pool = pool

    async def create_task_stub(
        self,
        task_type: str,
        entity_id: UUID,
        ctx: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Return a fake task record. Real implementation arrives in Phase 9.3."""
        task = {
            "task_id": uuid4(),
            "task_type": task_type,
            "entity_id": entity_id,
            "status": "OPEN",
            "stub": True,
        }
        logger.info(
            "task_stub_created",
            task_id=str(task["task_id"]),
            task_type=task_type,
            entity_id=str(entity_id),
            **(ctx or {}),
        )
        return task
