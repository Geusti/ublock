from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_admin
from app.models.admin_user import AdminUser
from app.schemas.auth import LoginRequest, TokenResponse, CurrentUserResponse
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates an administrator and returns a JWT access token."""
    admin = AuthService.authenticate_admin(db, request.email, request.password)
    token = AuthService.generate_token_for_admin(admin)

    # Log successful login in audit trail
    AuditService.log_event(
        db=db,
        organization_id=admin.organization_id,
        action="AUTH_LOGIN_SUCCESS",
        outcome="SUCCESS",
        actor_admin_id=admin.id,
        details={"email": admin.email, "role": admin.role}
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout", response_model=MessageResponse)
def logout(current_admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Logs out the current administrator."""
    AuditService.log_event(
        db=db,
        organization_id=current_admin.organization_id,
        action="AUTH_LOGOUT",
        outcome="SUCCESS",
        actor_admin_id=current_admin.id,
        details={"email": current_admin.email}
    )
    return MessageResponse(message="Sessão finalizada com sucesso")


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user_profile(current_admin: AdminUser = Depends(get_current_admin)):
    """Returns profile and organization info for the currently authenticated administrator."""
    return CurrentUserResponse(
        id=current_admin.id,
        email=current_admin.email,
        full_name=current_admin.full_name,
        role=current_admin.role,
        organization_id=current_admin.organization.id,
        organization_name=current_admin.organization.name,
        organization_slug=current_admin.organization.slug,
    )
