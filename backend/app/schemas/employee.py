from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.employee import EmployeeStatusEnum


class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=160)
    corporate_email: Optional[EmailStr] = None
    department_id: Optional[UUID] = None
    status: EmployeeStatusEnum = EmployeeStatusEnum.ACTIVE
    notes: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=160)
    corporate_email: Optional[EmailStr] = None
    department_id: Optional[UUID] = None
    status: Optional[EmployeeStatusEnum] = None
    notes: Optional[str] = None


class AssignedDeviceSummary(BaseModel):
    id: UUID
    hostname: str
    display_name: str
    os_family: str
    asset_tag: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime] = None


class EmployeeOut(BaseModel):
    id: UUID
    organization_id: UUID
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    full_name: str
    corporate_email: Optional[str] = None
    status: str
    notes: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    device_count: Optional[int] = 0

    class Config:
        from_attributes = True


class EmployeeDetailOut(EmployeeOut):
    assigned_devices: List[AssignedDeviceSummary] = []
