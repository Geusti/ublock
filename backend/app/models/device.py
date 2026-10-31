import uuid
import enum
from datetime import datetime, timezone, timedelta
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint, DateTime, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.department import Department
    from app.models.employee import Employee
    from app.models.device_account import DeviceAccount
    from app.models.device_telemetry import DeviceTelemetry
    from app.models.command import Command
    from app.models.device_agent import DeviceAgent, DeviceEnrollmentToken


class OSFamilyEnum(str, enum.Enum):
    WINDOWS = "WINDOWS"
    LINUX = "LINUX"
    MACOS = "MACOS"
    OTHER = "OTHER"


class DeviceStatusEnum(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ALERT = "ALERT"
    UNKNOWN = "UNKNOWN"
    RETIRED = "RETIRED"


class Device(Base, TimestampMixin):
    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("organization_id", "asset_tag", name="uq_device_org_asset_tag"),
        Index("idx_devices_org_status", "organization_id", "status"),
        Index("idx_devices_org_hostname", "organization_id", "hostname"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    hostname: Mapped[str] = mapped_column(String(160), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    os_family: Mapped[str] = mapped_column(String(20), default=OSFamilyEnum.WINDOWS.value, nullable=False)
    os_version: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    asset_tag: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    local_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=DeviceStatusEnum.UNKNOWN.value, nullable=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    agent_version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="devices")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="devices")
    assigned_employee: Mapped[Optional["Employee"]] = relationship("Employee", back_populates="devices")
    accounts: Mapped[List["DeviceAccount"]] = relationship("DeviceAccount", back_populates="device", cascade="all, delete-orphan")
    telemetries: Mapped[List["DeviceTelemetry"]] = relationship("DeviceTelemetry", back_populates="device", cascade="all, delete-orphan")
    commands: Mapped[List["Command"]] = relationship("Command", back_populates="device", cascade="all, delete-orphan")
    agent: Mapped[Optional["DeviceAgent"]] = relationship("DeviceAgent", back_populates="device", uselist=False, cascade="all, delete-orphan")
    enrollment_tokens: Mapped[List["DeviceEnrollmentToken"]] = relationship("DeviceEnrollmentToken", back_populates="device", cascade="all, delete-orphan")

    def get_effective_status(self, threshold_minutes: int = 15) -> str:
        """
        Dynamically calculates the status of the device based on last communication (heartbeat).
        If retired: RETIRED
        If explicitly marked with ALERT: ALERT
        If no last_seen_at: UNKNOWN
        If last_seen_at <= threshold_minutes: ONLINE
        If last_seen_at > threshold_minutes: OFFLINE
        """
        if self.status == DeviceStatusEnum.RETIRED.value:
            return DeviceStatusEnum.RETIRED.value
        if self.status == DeviceStatusEnum.ALERT.value:
            return DeviceStatusEnum.ALERT.value
        if self.last_seen_at is None:
            return DeviceStatusEnum.UNKNOWN.value

        now = datetime.now(timezone.utc)
        last_seen = self.last_seen_at
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)

        diff = now - last_seen
        if diff <= timedelta(minutes=threshold_minutes):
            return DeviceStatusEnum.ONLINE.value
        else:
            return DeviceStatusEnum.OFFLINE.value

    def get_agent_state(self, threshold_minutes: int = 15) -> str:
        """
        Returns one of:
        - NO_AGENT
        - PENDING_ENROLLMENT
        - REGISTERED_ONLINE
        - REGISTERED_OFFLINE
        - REVOKED
        """
        if not self.agent:
            return "NO_AGENT"
        if self.agent.status == "REVOKED":
            return "REVOKED"
        eff = self.get_effective_status(threshold_minutes=threshold_minutes)
        if eff == DeviceStatusEnum.ONLINE.value:
            return "REGISTERED_ONLINE"
        return "REGISTERED_OFFLINE"
