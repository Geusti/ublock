from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TelemetryOut(BaseModel):
    id: UUID
    device_id: UUID
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_total_gb: Optional[float] = None
    disk_free_gb: Optional[float] = None
    is_demo: bool = True
    recorded_at: datetime

    class Config:
        from_attributes = True


class DeviceAccountOut(BaseModel):
    id: UUID
    device_id: UUID
    username: str
    account_kind: str
    account_status: str
    is_demo: bool = True
    observed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
