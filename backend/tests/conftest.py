import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.main import app
from app.models.organization import Organization
from app.models.admin_user import AdminUser, RoleEnum
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatusEnum
from app.models.device import Device, OSFamilyEnum, DeviceStatusEnum
from app.models.device_account import DeviceAccount

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def org_a(db_session) -> Organization:
    org = Organization(name="Ubook Matriz", slug="ubook-matriz", is_demo=False)
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def org_b(db_session) -> Organization:
    org = Organization(name="Outra Empresa Ltda", slug="outra-empresa", is_demo=False)
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def super_admin(db_session, org_a) -> AdminUser:
    admin = AdminUser(
        organization_id=org_a.id,
        email="superadmin@ubook.test",
        password_hash=get_password_hash("SecretPass123!"),
        full_name="Super Administrador",
        role=RoleEnum.SUPER_ADMIN.value,
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def technician(db_session, org_a) -> AdminUser:
    admin = AdminUser(
        organization_id=org_a.id,
        email="tech@ubook.test",
        password_hash=get_password_hash("SecretPass123!"),
        full_name="Técnico de Suporte",
        role=RoleEnum.TECHNICIAN.value,
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def viewer(db_session, org_a) -> AdminUser:
    admin = AdminUser(
        organization_id=org_a.id,
        email="viewer@ubook.test",
        password_hash=get_password_hash("SecretPass123!"),
        full_name="Visualizador de Auditoria",
        role=RoleEnum.VIEWER.value,
        is_active=True
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def super_admin_headers(super_admin) -> dict:
    token = create_access_token(subject=str(super_admin.id), role=super_admin.role, org_id=str(super_admin.organization_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def tech_headers(technician) -> dict:
    token = create_access_token(subject=str(technician.id), role=technician.role, org_id=str(technician.organization_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_headers(viewer) -> dict:
    token = create_access_token(subject=str(viewer.id), role=viewer.role, org_id=str(viewer.organization_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_device(db_session, org_a) -> Device:
    device = Device(
        organization_id=org_a.id,
        hostname="UB-TEST-01",
        display_name="Workstation Teste",
        os_family=OSFamilyEnum.WINDOWS.value,
        os_version="Windows 11 Pro",
        asset_tag="TAG-1001",
        status=DeviceStatusEnum.ONLINE.value,
        local_ip="192.168.1.100"
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)

    # Local account
    acc = DeviceAccount(
        organization_id=org_a.id,
        device_id=device.id,
        username="john.doe",
        account_status="ACTIVE",
        is_demo=False
    )
    db_session.add(acc)
    db_session.commit()
    db_session.refresh(device)
    return device
