import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# Admin facing: Generate enrollment token
class EnrollmentTokenCreate(BaseModel):
    expires_in_hours: int = Field(24, ge=1, le=168, description="Tempo de expiração do código de registro em horas")


class EnrollmentTokenOut(BaseModel):
    enrollment_token: str
    expires_at: datetime
    device_id: Optional[uuid.UUID] = None
    device_name: Optional[str] = None
    installation_command: str


# Agent facing: Registration / Enrollment
class AgentEnrollRequest(BaseModel):
    enrollment_token: str = Field(..., min_length=16, max_length=64)
    agent_uuid: uuid.UUID
    agent_version: str = Field("1.0.0", max_length=40)
    hostname: str = Field(..., max_length=160)
    os_family: str = Field("WINDOWS", max_length=20)
    os_version: Optional[str] = Field(None, max_length=120)
    architecture: str = Field("amd64", max_length=20)


class AgentEnrollResponse(BaseModel):
    agent_id: uuid.UUID
    agent_key: str
    device_id: uuid.UUID
    organization_id: uuid.UUID
    heartbeat_interval_seconds: int = 60
    inventory_interval_seconds: int = 3600


# Agent facing: Heartbeat
class AgentHeartbeatRequest(BaseModel):
    agent_uuid: uuid.UUID
    uptime_seconds: Optional[int] = None
    agent_version: Optional[str] = None
    error_message: Optional[str] = Field(None, max_length=500)


class AgentHeartbeatResponse(BaseModel):
    status: str = "ACK"
    server_time: datetime
    next_heartbeat_seconds: int = 60


# Agent facing: Technical Inventory
class StorageDriveItem(BaseModel):
    drive: str
    total_bytes: int
    free_bytes: int
    fs_type: Optional[str] = None


class NetworkInterfaceItem(BaseModel):
    interface_name: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None


class CPUDetails(BaseModel):
    model: str
    cores: Optional[int] = None
    usage_percent: Optional[float] = None


class MemoryDetails(BaseModel):
    total_bytes: int
    available_bytes: int
    usage_percent: Optional[float] = None


class OSDetails(BaseModel):
    name: str
    version: Optional[str] = None
    build: Optional[str] = None
    arch: str = "amd64"


class AgentInventoryRequest(BaseModel):
    agent_uuid: uuid.UUID
    cpu: CPUDetails
    memory: MemoryDetails
    storage: List[StorageDriveItem] = []
    network: List[NetworkInterfaceItem] = []
    os_details: OSDetails
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    uptime_seconds: Optional[int] = None


class AgentInventoryResponse(BaseModel):
    status: str = "SUCCESS"
    recorded_at: datetime


# Admin facing: View Agent Details on Device
class DeviceAgentStatusOut(BaseModel):
    has_agent: bool
    agent_state: str  # NO_AGENT, PENDING_ENROLLMENT, REGISTERED_ONLINE, REGISTERED_OFFLINE, REVOKED
    agent_uuid: Optional[uuid.UUID] = None
    agent_version: Optional[str] = None
    status: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    last_inventory_at: Optional[datetime] = None
    uptime_seconds: Optional[int] = None
    last_error: Optional[str] = None
    hardware_info: Optional[Dict[str, Any]] = None
    registered_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    active_enrollment_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
