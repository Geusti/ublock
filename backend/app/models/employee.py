import uuid
import enum
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, Uuid, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.department import Department
    from app.models.device import Device


class EmployeeStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    corporate_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=EmployeeStatusEnum.ACTIVE.value, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="employees")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="employees")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="assigned_employee")
