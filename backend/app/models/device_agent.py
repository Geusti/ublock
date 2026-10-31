import uuid
import enum
from datetime import datetime
from typing import Optional, Any, Dict, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, DateTime, Uuid, JSON, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import utc_now

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.organization import Organization
    from app.models.admin_user import AdminUser


class AgentStatusEnum(str, enum.Enum):
    REGISTERED = "REGISTERED"
    REVOKED = "REVOKED"


class DeviceEnrollmentToken(Base):
    __tablename__ = "device_enrollment_tokens"
    __table_args__ = (
        Index("idx_enrollment_token_hash", "token_hash"),
        Index("idx_enrollment_device", "device_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("admin_users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    device: Mapped[Optional["Device"]] = relationship("Device")
    creator: Mapped["AdminUser"] = relationship("AdminUser")


class DeviceAgent(Base):
    __tablename__ = "device_agents"
    __table_args__ = (
        Index("idx_device_agents_token_hash", "token_hash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    agent_uuid: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_version: Mapped[str] = mapped_column(String(40), default="1.0.0", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=AgentStatusEnum.REGISTERED.value, nullable=False)
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_inventory_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    uptime_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    hardware_info: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    device: Mapped["Device"] = relationship("Device")
