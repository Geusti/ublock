import uuid
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.admin_user import AdminUser, RoleEnum
from app.models.organization import Organization

security_scheme = HTTPBearer(auto_error=False)


def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Authenticates the bearer token and returns the current active AdminUser."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedException("Cabeçalho de autorização ausente ou malformado")

    payload = decode_token(credentials.credentials)
    if not payload:
        raise UnauthorizedException("Token de acesso inválido ou expirado")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Identificador de usuário inválido no token")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException("Formato de UUID de usuário inválido")

    admin = db.query(AdminUser).filter(AdminUser.id == user_uuid).first()
    if not admin or not admin.is_active:
        raise UnauthorizedException("Usuário administrador inativo ou inexistente")

    # Verify organization exists
    org = db.query(Organization).filter(Organization.id == admin.organization_id).first()
    if not org:
        raise UnauthorizedException("Organização do administrador não encontrada")

    return admin


def require_roles(allowed_roles: List[str]):
    """Enforces role-based access control (RBAC)."""
    def role_checker(current_admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if current_admin.role not in allowed_roles:
            raise ForbiddenException(
                f"Seu perfil ({current_admin.role}) não tem permissão para realizar esta operação. "
                f"Perfis permitidos: {', '.join(allowed_roles)}"
            )
        return current_admin

    return role_checker


# Common role dependencies
require_super_admin = require_roles([RoleEnum.SUPER_ADMIN.value])
require_technician_or_higher = require_roles([RoleEnum.SUPER_ADMIN.value, RoleEnum.TECHNICIAN.value])
require_any_admin = require_roles([RoleEnum.SUPER_ADMIN.value, RoleEnum.TECHNICIAN.value, RoleEnum.VIEWER.value])
