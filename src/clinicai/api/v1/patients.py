"""FastAPI endpoints for Patient CRUD operations."""

from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, status

from clinicai.core.database import get_db_pool
from clinicai.core.exceptions import ResourceNotFoundError, ValidationError
from clinicai.schemas.patient import PatientCreateDTO, PatientDTO, PatientUpdateDTO
from clinicai.services.patient_service import PatientService

router = APIRouter()


@router.post(
    "/patients",
    response_model=PatientDTO,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient(
    data: PatientCreateDTO,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> PatientDTO:
    """Register a new patient and run Master Patient Index (MPI) deduplication."""
    service = PatientService(pool)
    return await service.create_patient(data)


@router.get("/patients/{id}", response_model=PatientDTO)
async def get_patient_by_id(
    id: UUID,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> PatientDTO:
    """Retrieve a single patient by ID. Raises ResourceNotFoundError if not found."""
    service = PatientService(pool)
    patient = await service.get_by_id(id)
    if patient is None:
        raise ResourceNotFoundError(f"Patient {id} not found")
    return patient


@router.get("/patients", response_model=list[PatientDTO])
async def get_patients_by_phone(
    phone: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> list[PatientDTO]:
    """Retrieve all patients matching a primary or secondary phone number."""
    if not phone.strip():
        raise ValidationError("phone query parameter must not be blank")
    service = PatientService(pool)
    return await service.get_by_phone(phone)


@router.patch("/patients/{id}", response_model=PatientDTO)
async def update_patient(
    id: UUID,
    data: PatientUpdateDTO,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> PatientDTO:
    """Partially update demographic details for a patient."""
    service = PatientService(pool)
    return await service.update_patient(id, data)
