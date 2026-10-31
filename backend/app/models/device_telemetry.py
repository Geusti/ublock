import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Numeric, Boolean, ForeignKey, DateTime, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import utc_now

if TYPE_CHECKING:
    from app.models.device import Device


class DeviceTelemetry(Base):
    __tablename__ = "device_telemetry"
    __table_args__ = (
        Index("idx_telemetry_device_time", "device_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    cpu_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    memory_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    disk_total_gb: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    disk_free_gb: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="telemetries")
