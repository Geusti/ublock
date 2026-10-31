import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.api.deps import require_any_admin, require_technician_or_higher
from app.models.admin_user import AdminUser
from app.models.command import Command
from app.models.device import Device
from app.models.device_account import DeviceAccount
from app.schemas.command import CommandCreate, CommandSimulateResult, CommandOut
from app.schemas.common import PaginatedResponse
from app.services.command_service import CommandService
from app.core.exceptions import NotFoundException

router = APIRouter(tags=["Commands"])


def format_command_out(cmd: Command) -> CommandOut:
    return CommandOut(
        id=cmd.id,
        organization_id=cmd.organization_id,
        device_id=cmd.device_id,
        device_name=cmd.device.display_name if cmd.device else None,
        target_account_id=cmd.target_account_id,
        target_username=cmd.target_account.username if cmd.target_account else None,
        action_type=cmd.action_type,
        mode=cmd.mode,
        status=cmd.status,
        requested_by=cmd.requested_by,
        requester_name=cmd.requester.full_name if cmd.requester else None,
        reason=cmd.reason,
        result_message=cmd.result_message,
        created_at=cmd.created_at,
        completed_at=cmd.completed_at
    )


@router.get("/commands", response_model=PaginatedResponse[CommandOut])
def list_commands(
    status_filter: Optional[str] = Query(None, alias="status"),
    device_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Lists simulated commands queued and executed in current organization."""
    query = (
        db.query(Command)
        .options(
            joinedload(Command.device),
            joinedload(Command.requester),
            joinedload(Command.target_account)
        )
        .filter(Command.organization_id == current_admin.organization_id)
    )

    if status_filter:
        query = query.filter(Command.status == status_filter.upper())

    if device_id:
        query = query.filter(Command.device_id == device_id)

    total = query.count()
    commands = (
        query.order_by(Command.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [format_command_out(c) for c in commands]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse[CommandOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("/devices/{device_id}/commands", response_model=CommandOut, status_code=status.HTTP_201_CREATED)
def create_device_command(
    payload: CommandCreate,
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Creates a simulated security command for a device.
    Strictly recorded in SIMULATION mode with full audit trail.
    No OS commands or system shells are executed.
    """
    cmd = CommandService.create_simulated_command(
        db=db,
        admin=current_admin,
        device_id=device_id,
        action_type=payload.action_type.value,
        target_account_id=payload.target_account_id,
        reason=payload.reason
    )
    # Reload with relationships
    db.refresh(cmd)
    return format_command_out(cmd)


@router.post("/commands/{command_id}/simulate-result", response_model=CommandOut)
def simulate_command_result(
    payload: CommandSimulateResult,
    command_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Simulates the final execution result of a pending command."""
    cmd = CommandService.simulate_result(
        db=db,
        admin=current_admin,
        command_id=command_id,
        succeeded=payload.succeeded,
        result_message=payload.result_message
    )
    return format_command_out(cmd)
