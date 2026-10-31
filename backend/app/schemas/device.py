from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.device import OSFamilyEnum, DeviceStatusEnum
from app.schemas.telemetry import DeviceAccountOut, TelemetryOut


class DeviceCreate(BaseModel):
    hostname: str = Field(..., min_length=2, max_length=160)
    display_name: str = Field(..., min_length=2, max_length=160)
    os_family: OSFamilyEnum = OSFamilyEnum.WINDOWS
    os_version: Optional[str] = Field(None, max_length=120)
    manufacturer: Optional[str] = Field(None, max_length=120)
    model: Optional[str] = Field(None, max_length=120)
    serial_number: Optional[str] = Field(None, max_length=160)
    asset_tag: Optional[str] = Field(None, max_length=100)
    assigned_employee_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    local_ip: Optional[str] = Field(None, max_length=45)
    status: DeviceStatusEnum = DeviceStatusEnum.UNKNOWN


class DeviceUpdate(BaseModel):
    hostname: Optional[str] = Field(None, min_length=2, max_length=160)
    display_name: Optional[str] = Field(None, min_length=2, max_length=160)
    os_family: Optional[OSFamilyEnum] = None
    os_version: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    assigned_employee_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    local_ip: Optional[str] = None
    status: Optional[DeviceStatusEnum] = None


class DeviceOut(BaseModel):
    id: UUID
    organization_id: UUID
    hostname: str
    display_name: str
    os_family: str
    os_version: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    assigned_employee_id: Optional[UUID] = None
    assigned_employee_name: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    local_ip: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime] = None
    agent_version: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeviceDetailOut(DeviceOut):
    accounts: List[DeviceAccountOut] = []
    latest_telemetry: Optional[TelemetryOut] = None
