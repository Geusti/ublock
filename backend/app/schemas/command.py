from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.command import ActionTypeEnum, CommandStatusEnum


class CommandCreate(BaseModel):
    action_type: ActionTypeEnum
    target_account_id: Optional[UUID] = None
    reason: Optional[str] = Field(None, max_length=500)


class CommandSimulateResult(BaseModel):
    succeeded: bool = True
    result_message: Optional[str] = Field(None, max_length=500)


class CommandOut(BaseModel):
    id: UUID
    organization_id: UUID
    device_id: UUID
    device_name: Optional[str] = None
    target_account_id: Optional[UUID] = None
    target_username: Optional[str] = None
    action_type: str
    mode: str
    status: str
    requested_by: UUID
    requester_name: Optional[str] = None
    reason: Optional[str] = None
    result_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
