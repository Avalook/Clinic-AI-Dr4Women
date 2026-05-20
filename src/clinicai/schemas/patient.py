"""Pydantic v2 schemas for Patient CRUD operations."""

from __future__ import annotations

import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class PatientCreateDTO(BaseModel):
    """Input schema for creating a new patient."""

    full_name: str
    date_of_birth: date | None = None
    phone_primary: str | None = None
    phone_secondary: str | None = None
    national_id_number: str | None = None
    location_id: UUID
    is_active: bool = True

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            msg = "full_name must not be blank"
            raise ValueError(msg)
        return v.strip()


class PatientUpdateDTO(BaseModel):
    """Input schema for partial-updating a patient. All fields optional."""

    full_name: str | None = None
    date_of_birth: date | None = None
    phone_primary: str | None = None
    phone_secondary: str | None = None
    national_id_number: str | None = None
    location_id: UUID | None = None
    is_active: bool | None = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            msg = "full_name must not be blank"
            raise ValueError(msg)
        return v.strip() if v else v


def _mask_national_id(value: str | None) -> str | None:
    """Mask CCCD for display: show first 3 and last 2 chars only."""
    if value is None:
        return None
    if len(value) <= 5:
        return re.sub(r".", "*", value)
    return value[:3] + "*" * (len(value) - 5) + value[-2:]


class PatientDTO(BaseModel):
    """Output schema returned from service layer. national_id is masked."""

    model_config = ConfigDict(from_attributes=True)

    clinic_patient_id: UUID
    patient_code: str
    national_id_number: str | None = None
    full_name: str
    date_of_birth: date | None = None
    phone_primary: str | None = None
    phone_secondary: str | None = None
    location_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("national_id_number", mode="before")
    @classmethod
    def mask_national_id(cls, v: str | None) -> str | None:
        return _mask_national_id(v)
