from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    is_active: bool
    created_at: datetime
    employee_count: Optional[int] = 0
    device_count: Optional[int] = 0

    class Config:
        from_attributes = True
