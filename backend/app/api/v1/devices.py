import uuid
import math
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_any_admin, require_technician_or_higher
from app.api.agent_deps import hash_token
from app.models.admin_user import AdminUser
from app.models.device import Device, DeviceStatusEnum
from app.models.employee import Employee
from app.models.department import Department
from app.models.device_account import DeviceAccount
from app.models.device_telemetry import DeviceTelemetry
from app.models.device_agent import DeviceEnrollmentToken, DeviceAgent, AgentStatusEnum
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceOut, DeviceDetailOut
from app.schemas.telemetry import DeviceAccountOut, TelemetryOut
from app.schemas.agent import EnrollmentTokenCreate, EnrollmentTokenOut, DeviceAgentStatusOut
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.audit_service import AuditService
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException

router = APIRouter(prefix="/devices", tags=["Devices"])


def format_device_out(device: Device) -> DeviceOut:
    effective_status = device.get_effective_status(threshold_minutes=settings.ONLINE_THRESHOLD_MINUTES)
    return DeviceOut(
        id=device.id,
        organization_id=device.organization_id,
        hostname=device.hostname,
        display_name=device.display_name,
        os_family=device.os_family,
        os_version=device.os_version,
        manufacturer=device.manufacturer,
        model=device.model,
        serial_number=device.serial_number,
        asset_tag=device.asset_tag,
        assigned_employee_id=device.assigned_employee_id,
        assigned_employee_name=device.assigned_employee.full_name if device.assigned_employee else None,
        department_id=device.department_id,
        department_name=device.department.name if device.department else None,
        local_ip=device.local_ip,
        status=effective_status,
        last_seen_at=device.last_seen_at,
        agent_version=device.agent_version,
        is_demo=device.is_demo,
        created_at=device.created_at,
        updated_at=device.updated_at,
    )


@router.get("", response_model=PaginatedResponse[DeviceOut])
def list_devices(
    search: Optional[str] = Query(None, description="Busca por hostname, nome, patrimônio, serial ou responsável"),
    os_family: Optional[str] = Query(None, description="Filtro por sistema operacional"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filtro por status de conectividade"),
    department_id: Optional[uuid.UUID] = Query(None, description="Filtro por departamento"),
    employee_id: Optional[uuid.UUID] = Query(None, description="Filtro por funcionário atribuído"),
    sort_by: str = Query("created_at", description="Coluna para ordenação (hostname, display_name, asset_tag, status, last_seen_at, created_at)"),
    sort_dir: str = Query("desc", description="Direção da ordenação: asc ou desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """
    Lists devices for the authenticated administrator's organization with filtering,
    multi-field search (including serial number and employee), column sorting, and pagination.
    """
    query = (
        db.query(Device)
        .options(joinedload(Device.assigned_employee), joinedload(Device.department))
        .filter(Device.organization_id == current_admin.organization_id)
    )

    if os_family:
        query = query.filter(Device.os_family == os_family.upper())

    if department_id:
        query = query.filter(Device.department_id == department_id)

    if employee_id:
        query = query.filter(Device.assigned_employee_id == employee_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.outerjoin(Device.assigned_employee).filter(
            or_(
                Device.hostname.ilike(search_term),
                Device.display_name.ilike(search_term),
                Device.asset_tag.ilike(search_term),
                Device.serial_number.ilike(search_term),
                Employee.full_name.ilike(search_term),
            )
        )

    # Column sorting
    sort_columns = {
        "hostname": Device.hostname,
        "display_name": Device.display_name,
        "asset_tag": Device.asset_tag,
        "status": Device.status,
        "last_seen_at": Device.last_seen_at,
        "created_at": Device.created_at,
    }
    sort_column = sort_columns.get(sort_by, Device.created_at)
    order_func = desc if sort_dir.lower() == "desc" else asc

    # Fetch all matching devices
    all_devices = query.order_by(order_func(sort_column)).all()

    # Filter by calculated/effective status if requested
    if status_filter:
        norm_status = status_filter.upper()
        all_devices = [
            d for d in all_devices
            if d.get_effective_status(settings.ONLINE_THRESHOLD_MINUTES) == norm_status
        ]

    total = len(all_devices)
    start_idx = (page - 1) * page_size
    paged_devices = all_devices[start_idx : start_idx + page_size]

    items = [format_device_out(d) for d in paged_devices]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse[DeviceOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Registers a new computer manually into the inventory."""
    # Check asset_tag uniqueness if provided
    if payload.asset_tag:
        existing = db.query(Device).filter(
            Device.organization_id == current_admin.organization_id,
            Device.asset_tag == payload.asset_tag.strip()
        ).first()
        if existing:
            raise ConflictException(f"Etiqueta de patrimônio '{payload.asset_tag}' já está em uso nesta organização.")

    # Validate employee if assigned
    if payload.assigned_employee_id:
        emp = db.query(Employee).filter(
            Employee.id == payload.assigned_employee_id,
            Employee.organization_id == current_admin.organization_id
        ).first()
        if not emp:
            raise NotFoundException("Funcionário atribuído não encontrado.")

    # Validate department if assigned
    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id,
            Department.organization_id == current_admin.organization_id
        ).first()
        if not dept:
            raise NotFoundException("Departamento atribuído não encontrado.")

    device = Device(
        organization_id=current_admin.organization_id,
        hostname=payload.hostname.strip(),
        display_name=payload.display_name.strip(),
        os_family=payload.os_family.value,
        os_version=payload.os_version,
        manufacturer=payload.manufacturer,
        model=payload.model,
        serial_number=payload.serial_number,
        asset_tag=payload.asset_tag.strip() if payload.asset_tag else None,
        assigned_employee_id=payload.assigned_employee_id,
        department_id=payload.department_id,
        local_ip=payload.local_ip,
        status=payload.status.value,
        is_demo=False
    )
    db.add(device)
    db.commit()
    db.refresh(device)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEVICE_CREATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        device_id=device.id,
        details={
            "hostname": device.hostname,
            "display_name": device.display_name,
            "asset_tag": device.asset_tag,
            "assigned_employee_id": str(device.assigned_employee_id) if device.assigned_employee_id else None
        }
    )

    return format_device_out(device)


@router.get("/{device_id}", response_model=DeviceDetailOut)
def get_device(
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Returns detailed information of a specific computer."""
    device = (
        db.query(Device)
        .options(
            joinedload(Device.assigned_employee),
            joinedload(Device.department),
            joinedload(Device.accounts)
        )
        .filter(
            Device.id == device_id,
            Device.organization_id == current_admin.organization_id
        )
        .first()
    )
    if not device:
        raise NotFoundException("Dispositivo não encontrado nesta organização.")

    # Get latest telemetry point
    latest_telemetry = (
        db.query(DeviceTelemetry)
        .filter(DeviceTelemetry.device_id == device.id)
        .order_by(DeviceTelemetry.recorded_at.desc())
        .first()
    )

    base_out = format_device_out(device)
    return DeviceDetailOut(
        **base_out.model_dump(),
        accounts=[
            DeviceAccountOut(
                id=a.id,
                device_id=a.device_id,
                username=a.username,
                account_kind=a.account_kind,
                account_status=a.account_status,
                is_demo=a.is_demo,
                observed_at=a.observed_at
            ) for a in device.accounts
        ],
        latest_telemetry=TelemetryOut.model_validate(latest_telemetry) if latest_telemetry else None
    )


@router.patch("/{device_id}", response_model=DeviceOut)
def update_device(
    payload: DeviceUpdate,
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Updates device metadata, including association or disassociation of employees
    and departments.
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado nesta organização.")

    update_dict = payload.model_dump(exclude_unset=True)

    # Validate asset_tag uniqueness if updated
    if "asset_tag" in update_dict and update_dict["asset_tag"]:
        existing = db.query(Device).filter(
            Device.organization_id == current_admin.organization_id,
            Device.asset_tag == update_dict["asset_tag"].strip(),
            Device.id != device.id
        ).first()
        if existing:
            raise ConflictException("Etiqueta de patrimônio já atribuída a outro ativo.")

    # Validate employee association if provided
    if "assigned_employee_id" in update_dict:
        emp_id = update_dict["assigned_employee_id"]
        if emp_id is not None:
            emp = db.query(Employee).filter(
                Employee.id == emp_id,
                Employee.organization_id == current_admin.organization_id
            ).first()
            if not emp:
                raise NotFoundException("Funcionário atribuído não encontrado.")

    # Validate department association if provided
    if "department_id" in update_dict:
        dept_id = update_dict["department_id"]
        if dept_id is not None:
            dept = db.query(Department).filter(
                Department.id == dept_id,
                Department.organization_id == current_admin.organization_id
            ).first()
            if not dept:
                raise NotFoundException("Departamento atribuído não encontrado.")

    for field, value in update_dict.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(device, field, value)

    db.commit()
    db.refresh(device)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEVICE_UPDATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        device_id=device.id,
        details={
            "updated_fields": list(update_dict.keys()),
            "hostname": device.hostname,
            "assigned_employee_id": str(device.assigned_employee_id) if device.assigned_employee_id else None
        }
    )

    return format_device_out(device)


@router.delete("/{device_id}", response_model=MessageResponse)
def retire_device(
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Retires a computer (soft-delete / status=RETIRED) to preserve audit and history."""
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado.")

    device.status = DeviceStatusEnum.RETIRED.value
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEVICE_RETIRE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        device_id=device.id,
        details={"hostname": device.hostname, "status": "RETIRED"}
    )

    return MessageResponse(message=f"Dispositivo '{device.display_name}' retirado de uso com sucesso.")


@router.get("/{device_id}/accounts", response_model=List[DeviceAccountOut])
def get_device_accounts(
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Lists local accounts detected on the device (simulated demo data in Phase 1/2)."""
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado.")

    accounts = db.query(DeviceAccount).filter(DeviceAccount.device_id == device.id).all()
    return [
        DeviceAccountOut(
            id=a.id,
            device_id=a.device_id,
            username=a.username,
            account_kind=a.account_kind,
            account_status=a.account_status,
            is_demo=a.is_demo,
            observed_at=a.observed_at
        ) for a in accounts
    ]


@router.get("/{device_id}/telemetry", response_model=List[TelemetryOut])
def get_device_telemetry(
    device_id: uuid.UUID = Path(...),
    limit: int = Query(20, ge=1, le=100),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Returns telemetry history for a device."""
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado.")

    telemetry = (
        db.query(DeviceTelemetry)
        .filter(DeviceTelemetry.device_id == device.id)
        .order_by(DeviceTelemetry.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [TelemetryOut.model_validate(t) for t in telemetry]


@router.post("/bulk-enrollment-token", response_model=EnrollmentTokenOut)
def generate_bulk_enrollment_token(
    payload: EnrollmentTokenCreate,
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Generates a reusable organization-wide enrollment token for bulk deployments.
    Any machine that runs the agent with this token will automatically discover and register itself in the inventory!
    """
    now = datetime.now(timezone.utc)
    raw_token = f"ublock_bulk_{secrets.token_urlsafe(24)}"
    t_hash = hash_token(raw_token)
    expires_at = now + timedelta(hours=payload.expires_in_hours)

    token_record = DeviceEnrollmentToken(
        organization_id=current_admin.organization_id,
        device_id=None,  # Not bound to a single device -> Auto-Discovery!
        token_hash=t_hash,
        expires_at=expires_at,
        created_by=current_admin.id,
        created_at=now
    )
    db.add(token_record)
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="BULK_ENROLLMENT_TOKEN_GENERATED",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={
            "expires_at": expires_at.isoformat(),
            "type": "ORGANIZATION_BULK_DISCOVERY"
        }
    )

    command_example = f"nexus-agent.exe -enroll {raw_token} -api http://localhost:8000/api/v1"

    return EnrollmentTokenOut(
        enrollment_token=raw_token,
        expires_at=expires_at,
        device_id=None,
        device_name="Cadastro Automático em Lote (Auto-Discovery)",
        installation_command=command_example
    )


@router.post("/{device_id}/enrollment-token", response_model=EnrollmentTokenOut)
def generate_enrollment_token(
    payload: EnrollmentTokenCreate,
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Generates a single-use, cryptographically secure enrollment token with expiration
    for linking a Windows Go agent to this device.
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado nesta organização.")

    now = datetime.now(timezone.utc)
    raw_token = f"ublock_enr_{secrets.token_urlsafe(24)}"
    t_hash = hash_token(raw_token)
    expires_at = now + timedelta(hours=payload.expires_in_hours)

    token_record = DeviceEnrollmentToken(
        organization_id=current_admin.organization_id,
        device_id=device.id,
        token_hash=t_hash,
        expires_at=expires_at,
        created_by=current_admin.id,
        created_at=now
    )
    db.add(token_record)
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="ENROLLMENT_TOKEN_GENERATED",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        device_id=device.id,
        details={
            "expires_at": expires_at.isoformat(),
            "hostname": device.hostname
        }
    )

    command_example = f"nexus-agent.exe -enroll {raw_token} -api https://api.ublock.local/api/v1"

    return EnrollmentTokenOut(
        enrollment_token=raw_token,
        expires_at=expires_at,
        device_id=device.id,
        device_name=device.display_name,
        installation_command=command_example
    )


@router.get("/{device_id}/agent", response_model=DeviceAgentStatusOut)
def get_device_agent_status(
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """
    Returns the real monitoring agent connection status, latest heartbeat,
    and collected hardware specifications.
    """
    device = (
        db.query(Device)
        .options(joinedload(Device.agent))
        .filter(
            Device.id == device_id,
            Device.organization_id == current_admin.organization_id
        )
        .first()
    )
    if not device:
        raise NotFoundException("Dispositivo não encontrado nesta organização.")

    agent = device.agent
    now = datetime.now(timezone.utc)

    # Check for active pending enrollment token
    pending_token = (
        db.query(DeviceEnrollmentToken)
        .filter(
            DeviceEnrollmentToken.device_id == device.id,
            DeviceEnrollmentToken.used_at.is_(None),
            DeviceEnrollmentToken.expires_at > now
        )
        .order_by(DeviceEnrollmentToken.created_at.desc())
        .first()
    )

    agent_state = device.get_agent_state(settings.ONLINE_THRESHOLD_MINUTES)
    if not agent and pending_token:
        agent_state = "PENDING_ENROLLMENT"

    return DeviceAgentStatusOut(
        has_agent=agent is not None,
        agent_state=agent_state,
        agent_uuid=agent.agent_uuid if agent else None,
        agent_version=agent.agent_version if agent else None,
        status=agent.status if agent else None,
        last_heartbeat_at=agent.last_heartbeat_at if agent else None,
        last_inventory_at=agent.last_inventory_at if agent else None,
        uptime_seconds=agent.uptime_seconds if agent else None,
        last_error=agent.last_error if agent else None,
        hardware_info=agent.hardware_info if agent else None,
        registered_at=agent.registered_at if agent else None,
        revoked_at=agent.revoked_at if agent else None,
        active_enrollment_token="SIMULADO_OU_ATIVO" if pending_token else None,
        token_expires_at=pending_token.expires_at if pending_token else None
    )


@router.post("/{device_id}/agent/revoke", response_model=MessageResponse)
def revoke_device_agent(
    device_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Revokes the agent's authentication credential, permanently disallowing further heartbeats
    until a new enrollment is authorized.
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == current_admin.organization_id
    ).first()
    if not device:
        raise NotFoundException("Dispositivo não encontrado nesta organização.")

    agent = db.query(DeviceAgent).filter(DeviceAgent.device_id == device.id).first()
    if not agent:
        raise NotFoundException("Nenhum agente vinculado a este computador.")

    now = datetime.now(timezone.utc)
    agent.status = AgentStatusEnum.REVOKED.value
    agent.revoked_at = now
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="AGENT_REVOKED",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        device_id=device.id,
        details={
            "agent_uuid": str(agent.agent_uuid),
            "hostname": device.hostname
        }
    )

    return MessageResponse(message=f"Agente do computador '{device.display_name}' revogado com sucesso. Novas requisições foram bloqueadas.")
