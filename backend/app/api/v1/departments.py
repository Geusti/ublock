import uuid
from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_any_admin, require_technician_or_higher
from app.models.admin_user import AdminUser
from app.models.department import Department
from app.models.employee import Employee
from app.models.device import Device
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.schemas.common import MessageResponse
from app.services.audit_service import AuditService
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException

router = APIRouter(prefix="/departments", tags=["Departments"])


def format_department_out(dept: Department, db: Session) -> DepartmentOut:
    emp_count = db.query(Employee).filter(Employee.department_id == dept.id).count()
    dev_count = db.query(Device).filter(Device.department_id == dept.id).count()
    return DepartmentOut(
        id=dept.id,
        organization_id=dept.organization_id,
        name=dept.name,
        is_active=dept.is_active,
        created_at=dept.created_at,
        employee_count=emp_count,
        device_count=dev_count
    )


@router.get("", response_model=List[DepartmentOut])
def list_departments(
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Lists all departments in current organization."""
    departments = (
        db.query(Department)
        .filter(Department.organization_id == current_admin.organization_id)
        .order_by(Department.name.asc())
        .all()
    )
    return [format_department_out(d, db) for d in departments]


@router.get("/{department_id}", response_model=DepartmentOut)
def get_department(
    department_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """Retrieves department details by ID."""
    dept = db.query(Department).filter(
        Department.id == department_id,
        Department.organization_id == current_admin.organization_id
    ).first()
    if not dept:
        raise NotFoundException("Departamento não encontrado.")
    return format_department_out(dept, db)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Creates a new department."""
    existing = db.query(Department).filter(
        Department.organization_id == current_admin.organization_id,
        Department.name.ilike(payload.name.strip())
    ).first()
    if existing:
        raise ConflictException("Já existe um departamento com este nome nesta organização.")

    dept = Department(
        organization_id=current_admin.organization_id,
        name=payload.name.strip(),
        is_active=payload.is_active
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEPARTMENT_CREATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={"name": dept.name, "is_active": dept.is_active}
    )

    return format_department_out(dept, db)


@router.patch("/{department_id}", response_model=DepartmentOut)
def update_department(
    payload: DepartmentUpdate,
    department_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """Updates a department name or active state."""
    dept = db.query(Department).filter(
        Department.id == department_id,
        Department.organization_id == current_admin.organization_id
    ).first()
    if not dept:
        raise NotFoundException("Departamento não encontrado.")

    if payload.name:
        existing = db.query(Department).filter(
            Department.organization_id == current_admin.organization_id,
            Department.name.ilike(payload.name.strip()),
            Department.id != dept.id
        ).first()
        if existing:
            raise ConflictException("Já existe outro departamento com este nome nesta organização.")
        dept.name = payload.name.strip()

    if payload.is_active is not None:
        dept.is_active = payload.is_active

    db.commit()
    db.refresh(dept)

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEPARTMENT_UPDATE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={"name": dept.name, "is_active": dept.is_active}
    )

    return format_department_out(dept, db)


@router.delete("/{department_id}", response_model=MessageResponse)
def delete_or_deactivate_department(
    department_id: uuid.UUID = Path(...),
    current_admin: AdminUser = Depends(require_technician_or_higher),
    db: Session = Depends(get_db)
):
    """
    Safely handles department deletion or logical deactivation.
    If employees or devices are associated, logically deactivates instead of breaking referential integrity.
    """
    dept = db.query(Department).filter(
        Department.id == department_id,
        Department.organization_id == current_admin.organization_id
    ).first()
    if not dept:
        raise NotFoundException("Departamento não encontrado.")

    emp_count = db.query(Employee).filter(Employee.department_id == dept.id).count()
    dev_count = db.query(Device).filter(Device.department_id == dept.id).count()

    if emp_count > 0 or dev_count > 0:
        dept.is_active = False
        db.commit()
        AuditService.log_event(
            db=db,
            organization_id=current_admin.organization_id,
            action="DEPARTMENT_DEACTIVATE",
            outcome="SUCCESS",
            actor_admin_id=current_admin.id,
            details={
                "name": dept.name,
                "reason": f"Possui {emp_count} colaboradores e {dev_count} ativos vinculados; desativado logicamente."
            }
        )
        return MessageResponse(
            message=f"Departamento '{dept.name}' possui {emp_count} funcionário(s) e {dev_count} ativo(s) vinculado(s) e foi desativado logicamente para preservar o histórico."
        )

    # If zero references, can delete
    name = dept.name
    db.delete(dept)
    db.commit()

    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="DEPARTMENT_DELETE",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={"name": name}
    )

    return MessageResponse(message=f"Departamento '{name}' excluído com sucesso.")
