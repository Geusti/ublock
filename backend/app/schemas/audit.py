from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: UUID
    organization_id: UUID
    actor_admin_id: Optional[UUID] = None
    actor_admin_name: Optional[str] = None
    device_id: Optional[UUID] = None
    device_name: Optional[str] = None
    command_id: Optional[UUID] = None
    action: str
    outcome: str
    details: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
