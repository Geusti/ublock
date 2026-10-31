import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_any_admin, require_technician_or_higher
from app.models.admin_user import AdminUser
from app.models.employee import Employee, EmployeeStatusEnum
from app.models.department import Department
from app.models.device import Device
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeOut, EmployeeDetailOut, AssignedDeviceSummary
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.audit_service import AuditService
from app.core.exceptions import NotFoundException, BadRequestException

router = APIRouter(prefix="/employees", tags=["Employees"])


def format_employee_out(emp: Employee, db: Session) -> EmployeeOut:
    device_count = db.query(Device).filter(Device.assigned_employee_id == emp.id).count()
    return EmployeeOut(
        id=emp.id,
        organization_id=emp.organization_id,
        department_id=emp.department_id,
        department_name=emp.department.name if emp.department else None,
        full_name=emp.full_name,
        corporate_email=emp.corporate_email,
        status=emp.status,
        notes=emp.notes,
        is_demo=emp.is_demo,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
        device_count=device_count
    )


@router.get("", response_model=PaginatedResponse[EmployeeOut])
def list_employees(
    search: Optional[str] = Query(None, description="Busca por nome ou e-mail"),
    department_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Lists employees in the organization."""
    query = (
        db.query(Employee)
        .options(joinedload(Employee.department))
        .filter(Employee.organization_id == current_admin.organization_id)
    )

    if department_id:
        query = query.filter(Employee.department_id == department_id)

    if status_filter:
        query = query.filter(Employee.status == status_filter.upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Employee.full_name.ilike(s), Employee.corporate_email.ilike(s)))

    total = query.count()
    employees = (
        query.order_by(Employee.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [format_employee_out(e, db) for e in employees]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse[EmployeeOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Creates a new employee."""
    if payload.department_id:
        dept = db.query(Department).filter(
            Department.id == payload.department_id,
            Department.organization_id == current_admin.organization_id
        ).first()
        if not dept:
            raise NotFoundException("Departamento não encontrado nesta organização.")
        if not dept.is_active:
            raise BadRequestException("Não é permitido associar funcionário a um departamento inativo.")

    employee = Employee(
        organization_id=current_admin.organization_id,
        department_id=payload.department_id,
        full_name=payload.full_name.strip(),
        corporate_email=str(payload.corporate_email).strip().lower() if payload.corporate_email else None,
        status=payload.status.value,
        notes=payload.notes,
        is_demo=False
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="EMPLOYEE_CREATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={
            "full_name": employee.full_name,
            "email": employee.corporate_email,
            "department_id": str(employee.department_id) if employee.department_id else None
        }
    )

    return format_employee_out(employee, db)


@router.get("/{employee_id}", response_model=EmployeeDetailOut)
def get_employee(
    employee_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Retrieves an employee by ID along with list of all assigned devices."""
    employee = (
        db.query(Employee)
        .options(joinedload(Employee.department), joinedload(Employee.devices))
        .filter(
            Employee.id == employee_id,
            Employee.organization_id == current_admin.organization_id
        )
        .first()
    )
    if not employee:
        raise NotFoundException("Funcionário não encontrado.")

    base_out = format_employee_out(employee, db)
    assigned_devices = [
        AssignedDeviceSummary(
            id=d.id,
            hostname=d.hostname,
            display_name=d.display_name,
            os_family=d.os_family,
            asset_tag=d.asset_tag,
            status=d.get_effective_status(threshold_minutes=settings.ONLINE_THRESHOLD_MINUTES),
            last_seen_at=d.last_seen_at
        )
        for d in employee.devices
    ]

    return EmployeeDetailOut(
        **base_out.model_dump(),
        assigned_devices=assigned_devices
    )


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    payload: EmployeeUpdate,
    employee_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Updates employee details."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == current_admin.organization_id
    ).first()
    if not employee:
        raise NotFoundException("Funcionário não encontrado.")

    update_dict = payload.model_dump(exclude_unset=True)
    if "department_id" in update_dict:
        dept_id = update_dict["department_id"]
        if dept_id is not None:
            dept = db.query(Department).filter(
                Department.id == dept_id,
                Department.organization_id == current_admin.organization_id
            ).first()
            if not dept:
                raise NotFoundException("Departamento não encontrado.")
            if not dept.is_active:
                raise BadRequestException("Não é permitido transferir funcionário para um departamento inativo.")

    for field, value in update_dict.items():
        if hasattr(value, "value"):
            value = value.value
        if field == "corporate_email" and value:
            value = str(value).strip().lower()
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="EMPLOYEE_UPDATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={
            "full_name": employee.full_name,
            "status": employee.status,
            "updated_fields": list(update_dict.keys())
        }
    )

    return format_employee_out(employee, db)


@router.delete("/{employee_id}", response_model=MessageResponse)
def deactivate_employee(
    employee_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Deactivates an employee (logical deactivation to preserve relationships and history).
    """
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == current_admin.organization_id
    ).first()
    if not employee:
        raise NotFoundException("Funcionário não encontrado.")

    employee.status = EmployeeStatusEnum.INACTIVE.value
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="EMPLOYEE_DEACTIVATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={"full_name": employee.full_name, "status": "INACTIVE"}
    )

    return MessageResponse(message=f"Funcionário '{employee.full_name}' desativado com sucesso.")
