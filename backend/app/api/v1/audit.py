import uuid
import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.api.deps import require_any_admin
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogOut
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("", response_model=PaginatedResponse[AuditLogOut])
def list_audit_logs(
    actor_id: Optional[uuid.UUID] = Query(None, description="Filtro por administrador"),
    device_id: Optional[uuid.UUID] = Query(None, description="Filtro por dispositivo"),
    action_type: Optional[str] = Query(None, description="Filtro por tipo de ação"),
    from_date: Optional[datetime] = Query(None, description="Data inicial UTC"),
    to_date: Optional[datetime] = Query(None, description="Data final UTC"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: AdminUser = Depends(require_any_admin),
    db: Session = Depends(get_db)
):
    """
    Returns immutable audit logs filtered by criteria for current organization.
    No endpoints exist to modify or delete audit entries.
    """
    query = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor), joinedload(AuditLog.device))
        .filter(AuditLog.organization_id == current_admin.organization_id)
    )

    if actor_id:
        query = query.filter(AuditLog.actor_admin_id == actor_id)

    if device_id:
        query = query.filter(AuditLog.device_id == device_id)

    if action_type:
        query = query.filter(AuditLog.action.ilike(f"%{action_type.strip()}%"))

    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)

    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        AuditLogOut(
            id=log.id,
            organization_id=log.organization_id,
            actor_admin_id=log.actor_admin_id,
            actor_admin_name=log.actor.full_name if log.actor else None,
            device_id=log.device_id,
            device_name=log.device.display_name if log.device else None,
            command_id=log.command_id,
            action=log.action,
            outcome=log.outcome,
            details=log.details,
            created_at=log.created_at
        )
        for log in logs
    ]

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse[AuditLogOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
