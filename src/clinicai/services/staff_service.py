"""Staff CRUD service using asyncpg pool."""

from __future__ import annotations

import datetime
from uuid import UUID

import asyncpg
import structlog

from clinicai.core.exceptions import ResourceNotFoundError, ValidationError
from clinicai.schemas.staff import StaffCreateDTO, StaffDTO, StaffUpdateDTO

logger = structlog.get_logger()


def _record_to_dto(record: asyncpg.Record) -> StaffDTO:
    """Convert an asyncpg Record into a StaffDTO."""
    return StaffDTO.model_validate(dict(record))


class StaffService:
    """CRUD operations for the staff table."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create_staff(self, data: StaffCreateDTO) -> StaffDTO:
        """Insert a new staff record and return the created DTO."""
        query = """
            INSERT INTO staff (
                full_name, short_name, primary_department,
                primary_location_id, employment_type,
                is_training, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                data.full_name,
                data.short_name,
                data.primary_department.value,
                data.primary_location_id,
                data.employment_type.value,
                data.is_training,
                data.is_active,
            )

        logger.info("staff_created", staff_id=str(row["id"]))
        return _record_to_dto(row)

    async def get_by_id(self, staff_id: UUID) -> StaffDTO | None:
        """Fetch a single staff member by primary key. Returns None if absent."""
        query = "SELECT * FROM staff WHERE id = $1;"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, staff_id)
        if row is None:
            return None
        return _record_to_dto(row)

    async def list_active(
        self,
        location_id: UUID | None = None,
    ) -> list[StaffDTO]:
        """Return all active staff, optionally filtered by location."""
        if location_id is not None:
            query = """
                SELECT * FROM staff
                WHERE is_active = TRUE AND primary_location_id = $1
                ORDER BY full_name;
            """
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(query, location_id)
        else:
            query = """
                SELECT * FROM staff
                WHERE is_active = TRUE
                ORDER BY full_name;
            """
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(query)
        return [_record_to_dto(r) for r in rows]

    async def list_assignable(self) -> list[StaffDTO]:
        """Return staff eligible for auto-assignment (D023 gate).

        Only staff who are:
          - is_active = TRUE
          - is_training = FALSE
        are returned.
        """
        query = """
            SELECT * FROM staff
            WHERE is_active = TRUE AND is_training = FALSE
            ORDER BY full_name;
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [_record_to_dto(r) for r in rows]

    async def update_staff(
        self,
        staff_id: UUID,
        data: StaffUpdateDTO,
    ) -> StaffDTO:
        """Partial-update a staff record. Only non-None fields are written."""
        updates = data.model_dump(exclude_none=True)
        if not updates:
            raise ValidationError("No fields to update")

        # Serialise enum values so asyncpg receives plain strings
        for key in ("primary_department", "employment_type"):
            if key in updates and hasattr(updates[key], "value"):
                updates[key] = updates[key].value

        set_parts: list[str] = []
        values: list[object] = []
        for idx, (col, val) in enumerate(updates.items(), start=1):
            set_parts.append(f"{col} = ${idx}")
            values.append(val)

        set_parts.append(f"updated_at = ${len(values) + 1}")
        values.append(datetime.datetime.now(tz=datetime.timezone.utc))

        values.append(staff_id)
        where_idx = len(values)

        query = (
            f"UPDATE staff SET {', '.join(set_parts)} "  # noqa: S608
            f"WHERE id = ${where_idx} "
            "RETURNING *;"
        )

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)

        if row is None:
            raise ResourceNotFoundError(f"Staff {staff_id} not found")

        logger.info(
            "staff_updated",
            staff_id=str(staff_id),
            fields=list(updates.keys()),
        )
        return _record_to_dto(row)

    async def deactivate(self, staff_id: UUID) -> None:
        """Soft-delete: set is_active = FALSE on the given staff member."""
        query = """
            UPDATE staff
            SET is_active = FALSE, updated_at = $2
            WHERE id = $1
            RETURNING id;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                staff_id,
                datetime.datetime.now(tz=datetime.timezone.utc),
            )

        if row is None:
            raise ResourceNotFoundError(f"Staff {staff_id} not found")

        logger.info("staff_deactivated", staff_id=str(staff_id))
