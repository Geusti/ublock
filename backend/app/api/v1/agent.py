import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.agent_deps import get_current_agent, hash_token
from app.models.device_agent import DeviceEnrollmentToken, DeviceAgent, AgentStatusEnum
from app.models.device import Device, DeviceStatusEnum
from app.models.device_telemetry import DeviceTelemetry
from app.schemas.agent import (
    AgentEnrollRequest,
    AgentEnrollResponse,
    AgentHeartbeatRequest,
    AgentHeartbeatResponse,
    AgentInventoryRequest,
    AgentInventoryResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/agent", tags=["Agent"])


@router.post("/enroll", response_model=AgentEnrollResponse)
def enroll_agent(payload: AgentEnrollRequest, db: Session = Depends(get_db)):
    """
    Enrolls a newly installed Go agent using a single-use, unexpired enrollment token.
    Issues a dedicated secret key for the agent and binds it to the device.
    """
    now = datetime.now(timezone.utc)
    token_hash = hash_token(payload.enrollment_token)

    # Validate enrollment token
    token_record = (
        db.query(DeviceEnrollmentToken)
        .filter(DeviceEnrollmentToken.token_hash == token_hash)
        .first()
    )

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de enrollment inválido ou inexistente."
        )

    if token_record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este código de enrollment já foi utilizado anteriormente."
        )

    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este código de enrollment expirou. Solicite um novo código no painel administrativo."
        )

    # Invalidate token only if it was device-specific (bulk/org tokens can be reused across machines)
    if token_record.device_id is not None:
        token_record.used_at = now

    device = None
    if token_record.device_id:
        device = db.query(Device).filter(Device.id == token_record.device_id).first()

    # If no device was bound to this token (Bulk / Auto-Discovery Enrollment), discover or create automatically
    if not device:
        # Check if a device with this hostname already exists in the organization
        device = (
            db.query(Device)
            .filter(
                Device.organization_id == token_record.organization_id,
                Device.hostname == payload.hostname.strip()
            )
            .first()
        )

        if not device:
            # Auto-register new computer from agent telemetry!
            device = Device(
                organization_id=token_record.organization_id,
                hostname=payload.hostname.strip(),
                display_name=payload.hostname.strip(),
                os_family=payload.os_family.upper() if payload.os_family else "WINDOWS",
                os_version=payload.os_version,
                status=DeviceStatusEnum.ONLINE.value,
                agent_version=payload.agent_version,
                last_seen_at=now,
                is_demo=False
            )
            db.add(device)
            db.commit()
            db.refresh(device)

    # Generate dedicated agent key
    agent_key = f"ublock_ak_{secrets.token_urlsafe(32)}"
    agent_key_hash = hash_token(agent_key)

    # Check if agent already exists for this device or create new
    agent = db.query(DeviceAgent).filter(DeviceAgent.device_id == device.id).first()
    if not agent:
        agent = DeviceAgent(
            organization_id=device.organization_id,
            device_id=device.id,
            agent_uuid=payload.agent_uuid,
            token_hash=agent_key_hash,
            agent_version=payload.agent_version,
            status=AgentStatusEnum.REGISTERED.value,
            last_heartbeat_at=now,
            registered_at=now,
            hardware_info={},
        )
        db.add(agent)
    else:
        # Re-registering existing device with fresh key
        agent.agent_uuid = payload.agent_uuid
        agent.token_hash = agent_key_hash
        agent.agent_version = payload.agent_version
        agent.status = AgentStatusEnum.REGISTERED.value
        agent.last_heartbeat_at = now
        agent.registered_at = now
        agent.revoked_at = None

    # Update device metadata
    device.agent_version = payload.agent_version
    device.os_family = payload.os_family.upper()
    if payload.os_version:
        device.os_version = payload.os_version
    device.last_seen_at = now
    device.is_demo = False  # Now receiving real agent reports!

    db.commit()
    db.refresh(agent)

    # Audit event
    AuditService.log_event(
        db=db,
        organization_id=device.organization_id,
        action="AGENT_ENROLLMENT_SUCCESS",
        outcome="SUCCESS",
        device_id=device.id,
        details={
            "agent_uuid": str(payload.agent_uuid),
            "agent_version": payload.agent_version,
            "hostname": payload.hostname,
            "architecture": payload.architecture
        }
    )

    return AgentEnrollResponse(
        agent_id=agent.id,
        agent_key=agent_key,
        device_id=device.id,
        organization_id=device.organization_id,
        heartbeat_interval_seconds=60,
        inventory_interval_seconds=3600,
    )


@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
def receive_heartbeat(
    payload: AgentHeartbeatRequest,
    agent: DeviceAgent = Depends(get_current_agent),
    db: Session = Depends(get_db)
):
    """
    Receives periodic heartbeat ping from the authenticated Go agent.
    Updates last_seen_at and uptime without writing heavy payloads to database.
    """
    now = datetime.now(timezone.utc)

    # Update agent state
    agent.last_heartbeat_at = now
    if payload.uptime_seconds is not None:
        agent.uptime_seconds = payload.uptime_seconds
    if payload.agent_version:
        agent.agent_version = payload.agent_version
    if payload.error_message:
        agent.last_error = payload.error_message
    else:
        agent.last_error = None

    # Update device timestamp
    device = db.query(Device).filter(Device.id == agent.device_id).first()
    if device:
        device.last_seen_at = now
        device.is_demo = False
        if payload.agent_version:
            device.agent_version = payload.agent_version

    db.commit()

    return AgentHeartbeatResponse(
        status="ACK",
        server_time=now,
        next_heartbeat_seconds=60
    )


@router.post("/inventory", response_model=AgentInventoryResponse)
def receive_inventory(
    payload: AgentInventoryRequest,
    agent: DeviceAgent = Depends(get_current_agent),
    db: Session = Depends(get_db)
):
    """
    Receives comprehensive hardware, storage, and network technical inventory from the agent.
    Persists current hardware state and records a real telemetry data point.
    """
    now = datetime.now(timezone.utc)

    # Update agent hardware info (use mode='json' to serialize UUIDs and datetimes)
    inventory_data = payload.model_dump(mode="json")
    agent.hardware_info = inventory_data
    agent.last_inventory_at = now
    agent.last_heartbeat_at = now
    if payload.uptime_seconds is not None:
        agent.uptime_seconds = payload.uptime_seconds

    # Update device specs
    device = db.query(Device).filter(Device.id == agent.device_id).first()
    if device:
        device.last_seen_at = now
        device.is_demo = False
        if payload.manufacturer:
            device.manufacturer = payload.manufacturer
        if payload.model:
            device.model = payload.model
        if payload.serial_number:
            device.serial_number = payload.serial_number

        # Update local IP if network interfaces reported
        for net in payload.network:
            if net.ip_address and not net.ip_address.startswith("127."):
                device.local_ip = net.ip_address
                break

    # Persist real telemetry point
    total_disk_gb = sum(d.total_bytes for d in payload.storage) / (1024 ** 3) if payload.storage else 0.0
    free_disk_gb = sum(d.free_bytes for d in payload.storage) / (1024 ** 3) if payload.storage else 0.0

    telemetry = DeviceTelemetry(
        organization_id=agent.organization_id,
        device_id=agent.device_id,
        cpu_percent=payload.cpu.usage_percent,
        memory_percent=payload.memory.usage_percent,
        disk_total_gb=round(total_disk_gb, 2) if total_disk_gb > 0 else None,
        disk_free_gb=round(free_disk_gb, 2) if free_disk_gb > 0 else None,
        is_demo=False,
        recorded_at=now
    )
    db.add(telemetry)

    db.commit()

    return AgentInventoryResponse(
        status="SUCCESS",
        recorded_at=now
    )
