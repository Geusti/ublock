import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        organization_id: uuid.UUID,
        action: str,
        outcome: str = "SUCCESS",
        actor_admin_id: Optional[uuid.UUID] = None,
        device_id: Optional[uuid.UUID] = None,
        command_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Creates an immutable audit log entry."""
        log = AuditLog(
            organization_id=organization_id,
            actor_admin_id=actor_admin_id,
            device_id=device_id,
            command_id=command_id,
            action=action,
            outcome=outcome,
            details=details or {},
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
