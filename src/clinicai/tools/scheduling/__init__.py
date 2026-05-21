"""Scheduling-domain tools.

Each tool lives in its own submodule with the same name as the function
(e.g. find_work_sessions.find_work_sessions). To avoid shadowing the submodule
on the package namespace, we DO NOT re-export the function symbols at the
package level — import them from the submodule directly:

    from clinicai.tools.scheduling.find_work_sessions import find_work_sessions

The Pydantic input/output schemas are re-exported here for ergonomic typing
because there's no naming collision with submodules.
"""

from clinicai.tools.scheduling.cancel_appointment import (
    CancelAppointmentInput,
    CancelAppointmentOutput,
)
from clinicai.tools.scheduling.confirm_appointment import (
    ConfirmAppointmentInput,
    ConfirmAppointmentOutput,
)
from clinicai.tools.scheduling.create_appointment import (
    AppointmentConflictError,
    CreateAppointmentInput,
    CreateAppointmentOutput,
)
from clinicai.tools.scheduling.find_oncall import (
    FindOncallInput,
    OncallStaffOutput,
)
from clinicai.tools.scheduling.find_work_sessions import (
    FindWorkSessionsInput,
    FindWorkSessionsOutput,
    WorkSessionResult,
)

__all__ = [
    "AppointmentConflictError",
    "CancelAppointmentInput",
    "CancelAppointmentOutput",
    "ConfirmAppointmentInput",
    "ConfirmAppointmentOutput",
    "CreateAppointmentInput",
    "CreateAppointmentOutput",
    "FindOncallInput",
    "FindWorkSessionsInput",
    "FindWorkSessionsOutput",
    "OncallStaffOutput",
    "WorkSessionResult",
]
