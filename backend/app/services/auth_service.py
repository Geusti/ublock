from typing import Optional
from sqlalchemy.orm import Session
from app.models.admin_user import AdminUser
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException


class AuthService:
    @staticmethod
    def authenticate_admin(
        db: Session,
        email: str,
        password: str
    ) -> AdminUser:
        """Authenticates an admin user by email and password."""
        admin = db.query(AdminUser).filter(AdminUser.email == email.strip().lower()).first()
        if not admin or not admin.is_active:
            raise UnauthorizedException("Credenciais inválidas ou usuário inativo")
        
        if not verify_password(password, admin.password_hash):
            raise UnauthorizedException("Credenciais inválidas ou usuário inativo")
        
        return admin

    @staticmethod
    def generate_token_for_admin(admin: AdminUser) -> str:
        """Generates access token for an authenticated admin."""
        return create_access_token(
            subject=str(admin.id),
            role=admin.role,
            org_id=str(admin.organization_id)
        )
