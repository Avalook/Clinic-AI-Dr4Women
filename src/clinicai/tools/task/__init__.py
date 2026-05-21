"""Task-domain tools (P9.3: real impl backed by `staff_task` table).

Modules:
- create_task — INSERT one row.
- query_tasks — filtered SELECT.
- update_task_status — UPDATE status + auto-set completed_at.
- check_sla — compute is_overdue / hours_remaining / hours_overdue.
"""

from clinicai.tools.task.check_sla import (
    SlaCheckResult,
    check_task_sla,
)
from clinicai.tools.task.check_sla import (
    TaskNotFoundError as SlaTaskNotFoundError,
)
from clinicai.tools.task.create_task import (
    CreateTaskInput,
    TaskPriority,
    TaskRow,
    TaskStatus,
    create_task,
)
from clinicai.tools.task.query_tasks import OrderBy, QueryTasksFilter, query_tasks
from clinicai.tools.task.update_task_status import (
    TaskNotFoundError,
    TaskStatusUpdate,
    UpdateTaskStatusInput,
    update_task_status,
)

__all__ = [
    "CreateTaskInput",
    "OrderBy",
    "QueryTasksFilter",
    "SlaCheckResult",
    "SlaTaskNotFoundError",
    "TaskNotFoundError",
    "TaskPriority",
    "TaskRow",
    "TaskStatus",
    "TaskStatusUpdate",
    "UpdateTaskStatusInput",
    "check_task_sla",
    "create_task",
    "query_tasks",
    "update_task_status",
]
