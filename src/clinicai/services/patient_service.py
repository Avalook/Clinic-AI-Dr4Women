"""Patient CRUD service using asyncpg pool."""

from __future__ import annotations

import datetime
from uuid import UUID

import asyncpg
import structlog

from clinicai.core.exceptions import ResourceNotFoundError, ValidationError
from clinicai.schemas.patient import PatientCreateDTO, PatientDTO, PatientUpdateDTO

logger = structlog.get_logger()


def _generate_patient_code() -> str:
    """Generate a human-readable patient code: BN-YYYY-XXXXXX.

    Uses current year + microsecond-resolution timestamp suffix for
    uniqueness. The DB column has a UNIQUE constraint as a safety net.
    """
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    seq = now.strftime("%f")  # microseconds → 6 digits
    return f"BN-{now.year}-{seq}"


def _record_to_dto(record: asyncpg.Record) -> PatientDTO:
    """Convert an asyncpg Record into a PatientDTO."""
    return PatientDTO.model_validate(dict(record))


class PatientService:
    """CRUD operations for the patient table."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create_patient(self, data: PatientCreateDTO) -> PatientDTO:
        """Insert a new patient row, run MPI dedup, and return the record."""
        patient_code = _generate_patient_code()

        query = """
            INSERT INTO patient (
                patient_code, full_name, date_of_birth,
                phone_primary, phone_secondary,
                national_id_number, location_id, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        """
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    query,
                    patient_code,
                    data.full_name,
                    data.date_of_birth,
                    data.phone_primary,
                    data.phone_secondary,
                    data.national_id_number,
                    data.location_id,
                    data.is_active,
                )
        except asyncpg.UniqueViolationError as exc:
            logger.warning(
                "patient_create_duplicate",
                patient_code=patient_code,
                error=str(exc),
            )
            raise ValidationError("Duplicate patient record") from exc

        logger.info(
            "patient_created",
            clinic_patient_id=str(row["clinic_patient_id"]),
            patient_code=patient_code,
        )
        dto = _record_to_dto(row)

        # --- MPI deduplication (non-blocking) ---
        try:
            from clinicai.services.mpi_service import MPIService

            mpi = MPIService()
            candidates = await mpi.find_candidates(self._pool, data)
            if candidates:
                queued = await mpi.auto_queue_if_needed(
                    self._pool, dto.clinic_patient_id, candidates
                )
                if queued:
                    logger.info(
                        "mpi_auto_queued",
                        clinic_patient_id=str(dto.clinic_patient_id),
                        queue_count=len(queued),
                    )
        except Exception:
            logger.warning(
                "mpi_dedup_failed",
                clinic_patient_id=str(dto.clinic_patient_id),
                exc_info=True,
            )

        return dto

    async def get_by_id(self, clinic_patient_id: UUID) -> PatientDTO | None:
        """Fetch a single patient by primary key. Returns None if absent."""
        query = "SELECT * FROM patient WHERE clinic_patient_id = $1;"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, clinic_patient_id)
        if row is None:
            return None
        return _record_to_dto(row)

    async def get_summary_data(self, clinic_patient_id: UUID) -> dict | None:
        """Return raw summary fields for the tools layer.

        Joins patient + EXISTS pregnancy(ONGOING) + MAX appointment(COMPLETED).
        Returns None if patient does not exist. The tool layer wraps the dict
        into PatientSummaryOutput — keeping shaping out of the service.
        """
        query = """
            SELECT
                p.clinic_patient_id,
                p.patient_code,
                p.full_name,
                p.phone_primary,
                p.date_of_birth,
                (
                    SELECT MAX(a.slot_start)::date
                    FROM appointment a
                    WHERE a.clinic_patient_id = p.clinic_patient_id
                      AND a.status = 'COMPLETED'
                ) AS last_visit_date,
                EXISTS (
                    SELECT 1 FROM pregnancy pr
                    WHERE pr.clinic_patient_id = p.clinic_patient_id
                      AND pr.outcome = 'ONGOING'
                ) AS active_pregnancy
            FROM patient p
            WHERE p.clinic_patient_id = $1;
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, clinic_patient_id)
        if row is None:
            return None
        return dict(row)

    async def get_by_phone(self, phone: str) -> list[PatientDTO]:
        """Return all patients matching a phone number (primary or secondary)."""
        query = """
            SELECT * FROM patient
            WHERE phone_primary = $1 OR phone_secondary = $1
            ORDER BY created_at DESC;
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, phone)
        return [_record_to_dto(r) for r in rows]

    async def update_patient(
        self, clinic_patient_id: UUID, data: PatientUpdateDTO
    ) -> PatientDTO:
        """Partial-update a patient. Only non-None fields are written."""
        updates = data.model_dump(exclude_none=True)
        if not updates:
            raise ValidationError("No fields to update")

        # Build dynamic SET clause
        set_parts: list[str] = []
        values: list[object] = []
        for idx, (col, val) in enumerate(updates.items(), start=1):
            set_parts.append(f"{col} = ${idx}")
            values.append(val)

        # Always touch updated_at
        set_parts.append(f"updated_at = ${len(values) + 1}")
        values.append(datetime.datetime.now(tz=datetime.timezone.utc))

        # WHERE clause param
        values.append(clinic_patient_id)
        where_idx = len(values)

        query = (
            f"UPDATE patient SET {', '.join(set_parts)} "
            f"WHERE clinic_patient_id = ${where_idx} "
            "RETURNING *;"
        )

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)

        if row is None:
            raise ResourceNotFoundError(f"Patient {clinic_patient_id} not found")

        logger.info(
            "patient_updated",
            clinic_patient_id=str(clinic_patient_id),
            fields=list(updates.keys()),
        )
        return _record_to_dto(row)
