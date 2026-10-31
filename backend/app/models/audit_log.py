import uuid
from datetime import datetime
from typing import Optional, Any, Dict, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, DateTime, Uuid, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import utc_now

if TYPE_CHECKING:
    from app.models.admin_user import AdminUser
    from app.models.device import Device
    from app.models.command import Command


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_org_time", "organization_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    command_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("commands.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    outcome: Mapped[str] = mapped_column(String(40), nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    actor: Mapped[Optional["AdminUser"]] = relationship("AdminUser")
    device: Mapped[Optional["Device"]] = relationship("Device")
    command: Mapped[Optional["Command"]] = relationship("Command")
