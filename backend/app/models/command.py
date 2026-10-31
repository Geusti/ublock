import uuid
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, DateTime, Uuid, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import utc_now

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.admin_user import AdminUser
    from app.models.device_account import DeviceAccount


class ActionTypeEnum(str, enum.Enum):
    SUSPEND_LOCAL_ACCOUNT = "SUSPEND_LOCAL_ACCOUNT"
    REACTIVATE_LOCAL_ACCOUNT = "REACTIVATE_LOCAL_ACCOUNT"
    END_USER_SESSION = "END_USER_SESSION"
    ISOLATE_DEVICE_NETWORK = "ISOLATE_DEVICE_NETWORK"
    EMERGENCY_LOCKDOWN = "EMERGENCY_LOCKDOWN"


class CommandStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    SUCCEEDED_SIMULATED = "SUCCEEDED_SIMULATED"
    FAILED_SIMULATED = "FAILED_SIMULATED"


class Command(Base):
    __tablename__ = "commands"
    __table_args__ = (
        Index("idx_commands_org_status", "organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    target_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("device_accounts.id", ondelete="SET NULL"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    mode: Mapped[str] = mapped_column(String(20), default="SIMULATION", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=CommandStatusEnum.PENDING.value, nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("admin_users.id"), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="commands")
    requester: Mapped["AdminUser"] = relationship("AdminUser")
    target_account: Mapped[Optional["DeviceAccount"]] = relationship("DeviceAccount")
