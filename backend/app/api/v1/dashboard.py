from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_any_admin
from app.models.admin_user import AdminUser
from app.models.device import Device, DeviceStatusEnum
from app.models.employee import Employee, EmployeeStatusEnum
from app.models.department import Department
from app.models.command import Command, CommandStatusEnum
from app.models.audit_log import AuditLog
from app.schemas.dashboard import (
    DashboardSummaryOut,
    OSCount,
    DepartmentCount,
    AlertDeviceItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated indicators for the admin dashboard scoped to current organization.
    Computes online/offline dynamically based on last communication threshold.
    """
    org_id = current_admin.organization_id
    now = datetime.now(timezone.utc)
    stale_date = now - timedelta(days=settings.STALE_THRESHOLD_DAYS)

    # Load devices to calculate real effective status
    devices = (
        db.query(Device)
        .options(joinedload(Device.assigned_employee), joinedload(Device.department))
        .filter(Device.organization_id == org_id)
        .all()
    )

    total_devices = len(devices)
    online_devices = 0
    offline_devices = 0
    alert_devices = 0
    retired_devices = 0
    unknown_devices = 0
    stale_devices = 0
    alert_devices_list: List[AlertDeviceItem] = []

    for d in devices:
        eff_status = d.get_effective_status(threshold_minutes=settings.ONLINE_THRESHOLD_MINUTES)
        if eff_status == DeviceStatusEnum.RETIRED.value:
            retired_devices += 1
        elif eff_status == DeviceStatusEnum.ALERT.value:
            alert_devices += 1
            alert_devices_list.append(
                AlertDeviceItem(
                    id=d.id,
                    hostname=d.hostname,
                    display_name=d.display_name,
                    os_family=d.os_family,
                    asset_tag=d.asset_tag,
                    assigned_employee_name=d.assigned_employee.full_name if d.assigned_employee else None,
                    department_name=d.department.name if d.department else None,
                    status=eff_status,
                    last_seen_at=d.last_seen_at,
                )
            )
        elif eff_status == DeviceStatusEnum.ONLINE.value:
            online_devices += 1
        elif eff_status == DeviceStatusEnum.OFFLINE.value:
            offline_devices += 1
        else:
            unknown_devices += 1

        # Check stale (without recent communication)
        if eff_status != DeviceStatusEnum.RETIRED.value:
            if d.last_seen_at is None or (
                d.last_seen_at.replace(tzinfo=timezone.utc) if d.last_seen_at.tzinfo is None else d.last_seen_at
            ) < stale_date:
                stale_devices += 1

    # Pending commands
    pending_commands = db.query(Command).filter(
        Command.organization_id == org_id,
        Command.status == CommandStatusEnum.PENDING.value
    ).count()

    # Total employees and departments
    total_employees = db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatusEnum.ACTIVE.value).count()
    total_departments = db.query(Department).filter(Department.organization_id == org_id, Department.is_active == True).count()

    # OS distribution
    os_query = (
        db.query(Device.os_family, func.count(Device.id))
        .filter(Device.organization_id == org_id)
        .group_by(Device.os_family)
        .all()
    )
    os_distribution = [OSCount(os_family=row[0], count=row[1]) for row in os_query]

    # Department distribution
    dept_query = (
        db.query(Department.id, Department.name, func.count(Device.id))
        .join(Device, Device.department_id == Department.id)
        .filter(Department.organization_id == org_id)
        .group_by(Department.id, Department.name)
        .all()
    )
    dept_distribution = [
        DepartmentCount(department_id=row[0], department_name=row[1], count=row[2])
        for row in dept_query
    ]

    # Include unassigned to department count if any
    unassigned_dept_count = (
        db.query(Device)
        .filter(Device.organization_id == org_id, Device.department_id.is_(None))
        .count()
    )
    if unassigned_dept_count > 0:
        dept_distribution.append(
            DepartmentCount(department_id=None, department_name="Sem Departamento", count=unassigned_dept_count)
        )

    # Recent activity
    recent_logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor), joinedload(AuditLog.device))
        .filter(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(6)
        .all()
    )
    recent_activity = [
        {
            "id": str(log.id),
            "action": log.action,
            "outcome": log.outcome,
            "actor_name": log.actor.full_name if log.actor else "Sistema",
            "device_name": log.device.display_name if log.device else None,
            "created_at": log.created_at.isoformat(),
        }
        for log in recent_logs
    ]

    return DashboardSummaryOut(
        total_devices=total_devices,
        online_devices=online_devices,
        offline_devices=offline_devices,
        alert_devices=alert_devices,
        stale_devices=stale_devices,
        retired_devices=retired_devices,
        unknown_devices=unknown_devices,
        pending_commands=pending_commands,
        total_employees=total_employees,
        total_departments=total_departments,
        os_distribution=os_distribution,
        department_distribution=dept_distribution,
        recent_activity=recent_activity,
        alert_devices_list=alert_devices_list,
        is_simulation_mode=True,
    )
