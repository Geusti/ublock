import sys
import argparse
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.organization import Organization
from app.models.admin_user import AdminUser, RoleEnum
from app.services.audit_service import AuditService


def bootstrap_admin(
    email: str = settings.BOOTSTRAP_ADMIN_EMAIL,
    password: str = settings.BOOTSTRAP_ADMIN_PASSWORD,
    full_name: str = settings.BOOTSTRAP_ADMIN_NAME,
    org_name: str = settings.BOOTSTRAP_ORG_NAME,
    org_slug: str = settings.BOOTSTRAP_ORG_SLUG,
):
    """Creates the initial organization and super admin if not already present."""
    if not password:
        print("[ERRO] Senha do administrador não informada. Defina BOOTSTRAP_ADMIN_PASSWORD no .env ou passe como argumento.")
        sys.exit(1)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # 1. Organization
        org = db.query(Organization).filter(Organization.slug == org_slug).first()
        if not org:
            org = Organization(
                name=org_name,
                slug=org_slug,
                is_demo=False
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"[OK] Organização '{org.name}' ({org.slug}) criada com sucesso (ID: {org.id}).")
        else:
            print(f"[INFO] Organização '{org.name}' já existe (ID: {org.id}).")

        # 2. Super Admin User
        admin = db.query(AdminUser).filter(
            AdminUser.organization_id == org.id,
            AdminUser.email == email.strip().lower()
        ).first()

        if not admin:
            admin = AdminUser(
                organization_id=org.id,
                email=email.strip().lower(),
                password_hash=get_password_hash(password),
                full_name=full_name,
                role=RoleEnum.SUPER_ADMIN.value,
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

            AuditService.log_event(
                db=db,
                organization_id=org.id,
                action="BOOTSTRAP_SUPER_ADMIN_CREATED",
                outcome="SUCCESS",
                actor_admin_id=admin.id,
                details={"email": admin.email, "role": admin.role}
            )
            print(f"[OK] Administrador '{admin.email}' (SUPER_ADMIN) criado com sucesso.")
        else:
            # Update password if requested
            admin.password_hash = get_password_hash(password)
            admin.full_name = full_name
            admin.role = RoleEnum.SUPER_ADMIN.value
            admin.is_active = True
            db.commit()
            print(f"[INFO] Administrador '{admin.email}' atualizado com nova senha e perfil SUPER_ADMIN.")

    except Exception as exc:
        db.rollback()
        print(f"[FALHA] Erro durante o bootstrap: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap initial Ublock organization and super admin.")
    parser.add_argument("--email", default=settings.BOOTSTRAP_ADMIN_EMAIL, help="Admin email")
    parser.add_argument("--password", default=settings.BOOTSTRAP_ADMIN_PASSWORD, help="Admin password")
    parser.add_argument("--name", default=settings.BOOTSTRAP_ADMIN_NAME, help="Admin full name")
    parser.add_argument("--org-name", default=settings.BOOTSTRAP_ORG_NAME, help="Organization name")
    parser.add_argument("--org-slug", default=settings.BOOTSTRAP_ORG_SLUG, help="Organization slug")
    args = parser.parse_args()

    bootstrap_admin(
        email=args.email,
        password=args.password,
        full_name=args.name,
        org_name=args.org_name,
        org_slug=args.org_slug
    )
