import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.organization import Organization
from app.models.admin_user import AdminUser, RoleEnum
from app.models.department import Department
from app.models.employee import Employee, EmployeeStatusEnum
from app.models.device import Device, OSFamilyEnum, DeviceStatusEnum
from app.models.device_account import DeviceAccount
from app.models.device_telemetry import DeviceTelemetry
from app.models.command import Command, ActionTypeEnum, CommandStatusEnum
from app.services.audit_service import AuditService


def seed_demo_data():
    """Seeds rich demonstration data for the Ublock platform, clearly marked with is_demo=True."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        # 1. Demo Organization
        org = db.query(Organization).filter(Organization.slug == "ubook-demo").first()
        if not org:
            org = Organization(
                name="Ubook Tecnologia (Demonstração)",
                slug="ubook-demo",
                is_demo=True
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"[OK] Organização Demo criada: {org.name}")
        else:
            print(f"[INFO] Organização Demo já existe: {org.name}")

        # 2. Demo Admin Users (SuperAdmin, Technician, Viewer)
        demo_users = [
            ("admin@ubook.com.br", "Administrador Ublock", RoleEnum.SUPER_ADMIN.value, "UblockAdmin2026!"),
            ("tecnico@ubook.com.br", "Carlos Suporte TI", RoleEnum.TECHNICIAN.value, "UblockTech2026!"),
            ("auditor@ubook.com.br", "Mariana Auditoria", RoleEnum.VIEWER.value, "UblockView2026!"),
        ]

        admin_map = {}
        for email, name, role, pwd in demo_users:
            user = db.query(AdminUser).filter(AdminUser.organization_id == org.id, AdminUser.email == email).first()
            if not user:
                user = AdminUser(
                    organization_id=org.id,
                    email=email,
                    password_hash=get_password_hash(pwd),
                    full_name=name,
                    role=role,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            admin_map[role] = user

        # 3. Departments
        departments_data = [
            "Tecnologia da Informação",
            "Engenharia de Software",
            "Financeiro & Controladoria",
            "Comercial & Conteúdo",
            "Operações & Logística",
            "Recursos Humanos"
        ]
        dept_map = {}
        for dname in departments_data:
            dept = db.query(Department).filter(Department.organization_id == org.id, Department.name == dname).first()
            if not dept:
                dept = Department(organization_id=org.id, name=dname, is_active=True)
                db.add(dept)
                db.commit()
                db.refresh(dept)
            dept_map[dname] = dept

        # 4. Employees
        employees_data = [
            ("Rodrigo Silveira", "rodrigo.silveira@ubook.com.br", "Tecnologia da Informação"),
            ("Amanda Vasconcelos", "amanda.v@ubook.com.br", "Engenharia de Software"),
            ("Lucas Pinheiro", "lucas.pinheiro@ubook.com.br", "Engenharia de Software"),
            ("Beatriz Moura", "beatriz.moura@ubook.com.br", "Financeiro & Controladoria"),
            ("Felipe Albuquerque", "felipe.a@ubook.com.br", "Comercial & Conteúdo"),
            ("Juliana Mendes", "juliana.mendes@ubook.com.br", "Operações & Logística"),
            ("Camila Duarte", "camila.duarte@ubook.com.br", "Recursos Humanos"),
            ("Gabriel Martins", "gabriel.martins@ubook.com.br", "Tecnologia da Informação"),
        ]

        emp_map = {}
        for name, email, dept_name in employees_data:
            emp = db.query(Employee).filter(Employee.organization_id == org.id, Employee.corporate_email == email).first()
            if not emp:
                emp = Employee(
                    organization_id=org.id,
                    department_id=dept_map[dept_name].id,
                    full_name=name,
                    corporate_email=email,
                    status=EmployeeStatusEnum.ACTIVE.value,
                    notes="Colaborador Ubook em regime híbrido.",
                    is_demo=True
                )
                db.add(emp)
                db.commit()
                db.refresh(emp)
            emp_map[name] = emp

        # 5. Devices (Computers)
        devices_data = [
            {
                "hostname": "UB-ENG-01",
                "display_name": "Dell XPS 15 - Amanda",
                "os_family": OSFamilyEnum.WINDOWS.value,
                "os_version": "Windows 11 Pro 23H2",
                "manufacturer": "Dell Inc.",
                "model": "XPS 15 9530",
                "serial_number": "BR-DL-88231",
                "asset_tag": "UB-PAT-00101",
                "emp_name": "Amanda Vasconcelos",
                "dept_name": "Engenharia de Software",
                "local_ip": "192.168.10.45",
                "status": DeviceStatusEnum.ONLINE.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 24.5,
                "ram": 58.2,
                "disk_tot": 512.0,
                "disk_free": 240.5,
                "local_users": ["amanda.v", "Administrator", "DefaultAccount"]
            },
            {
                "hostname": "UB-ENG-02",
                "display_name": "MacBook Pro M2 - Lucas",
                "os_family": OSFamilyEnum.MACOS.value,
                "os_version": "macOS Sonoma 14.4",
                "manufacturer": "Apple",
                "model": "MacBook Pro 16-inch M2 Pro",
                "serial_number": "C02G99A3MD6T",
                "asset_tag": "UB-PAT-00102",
                "emp_name": "Lucas Pinheiro",
                "dept_name": "Engenharia de Software",
                "local_ip": "192.168.10.48",
                "status": DeviceStatusEnum.ONLINE.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 15.2,
                "ram": 42.1,
                "disk_tot": 1024.0,
                "disk_free": 612.0,
                "local_users": ["lucas.pinheiro", "root"]
            },
            {
                "hostname": "UB-FIN-01",
                "display_name": "Lenovo ThinkPad T14 - Beatriz",
                "os_family": OSFamilyEnum.WINDOWS.value,
                "os_version": "Windows 11 Pro 22H2",
                "manufacturer": "Lenovo",
                "model": "ThinkPad T14 Gen 4",
                "serial_number": "PF-37X09L",
                "asset_tag": "UB-PAT-00103",
                "emp_name": "Beatriz Moura",
                "dept_name": "Financeiro & Controladoria",
                "local_ip": "192.168.10.52",
                "status": DeviceStatusEnum.ALERT.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 88.4,
                "ram": 91.0,
                "disk_tot": 256.0,
                "disk_free": 18.2,
                "local_users": ["beatriz.moura", "ubook_admin"]
            },
            {
                "hostname": "UB-COM-01",
                "display_name": "HP EliteBook 840 - Felipe",
                "os_family": OSFamilyEnum.WINDOWS.value,
                "os_version": "Windows 10 Pro 22H2",
                "manufacturer": "HP",
                "model": "EliteBook 840 G9",
                "serial_number": "5CG23984KL",
                "asset_tag": "UB-PAT-00104",
                "emp_name": "Felipe Albuquerque",
                "dept_name": "Comercial & Conteúdo",
                "local_ip": "192.168.10.60",
                "status": DeviceStatusEnum.ONLINE.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 12.0,
                "ram": 38.5,
                "disk_tot": 512.0,
                "disk_free": 380.0,
                "local_users": ["felipe.a", "Guest"]
            },
            {
                "hostname": "UB-OPS-01",
                "display_name": "Dell Latitude 5430 - Juliana",
                "os_family": OSFamilyEnum.WINDOWS.value,
                "os_version": "Windows 11 Pro 23H2",
                "manufacturer": "Dell Inc.",
                "model": "Latitude 5430",
                "serial_number": "BR-DL-77312",
                "asset_tag": "UB-PAT-00105",
                "emp_name": "Juliana Mendes",
                "dept_name": "Operações & Logística",
                "local_ip": "192.168.10.71",
                "status": DeviceStatusEnum.OFFLINE.value,
                "agent_version": "0.9.8",
                "cpu": 5.0,
                "ram": 22.0,
                "disk_tot": 256.0,
                "disk_free": 140.0,
                "local_users": ["juliana.mendes"]
            },
            {
                "hostname": "UB-RH-01",
                "display_name": "MacBook Air M1 - Camila",
                "os_family": OSFamilyEnum.MACOS.value,
                "os_version": "macOS Sonoma 14.2",
                "manufacturer": "Apple",
                "model": "MacBook Air M1 2020",
                "serial_number": "C02F781XQ6L4",
                "asset_tag": "UB-PAT-00106",
                "emp_name": "Camila Duarte",
                "dept_name": "Recursos Humanos",
                "local_ip": "192.168.10.85",
                "status": DeviceStatusEnum.ONLINE.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 18.0,
                "ram": 64.0,
                "disk_tot": 256.0,
                "disk_free": 95.0,
                "local_users": ["camila.duarte", "admin"]
            },
            {
                "hostname": "UB-SRV-MONITOR",
                "display_name": "Servidor Monitoramento Ubuntu",
                "os_family": OSFamilyEnum.LINUX.value,
                "os_version": "Ubuntu 22.04.4 LTS",
                "manufacturer": "Supermicro",
                "model": "SYS-5019P-MT",
                "serial_number": "SM-990182",
                "asset_tag": "UB-PAT-00050",
                "emp_name": "Rodrigo Silveira",
                "dept_name": "Tecnologia da Informação",
                "local_ip": "10.0.1.15",
                "status": DeviceStatusEnum.ONLINE.value,
                "agent_version": "1.0.0-rc1",
                "cpu": 32.1,
                "ram": 45.8,
                "disk_tot": 2048.0,
                "disk_free": 1650.0,
                "local_users": ["root", "deploy", "rodrigo"]
            },
            {
                "hostname": "UB-TI-TESTLAB",
                "display_name": "Bancada de Testes TI",
                "os_family": OSFamilyEnum.LINUX.value,
                "os_version": "Debian GNU/Linux 12 (bookworm)",
                "manufacturer": "Custom Workstation",
                "model": "TI Lab PC",
                "serial_number": "LAB-TI-01",
                "asset_tag": "UB-PAT-00055",
                "emp_name": "Gabriel Martins",
                "dept_name": "Tecnologia da Informação",
                "local_ip": "10.0.1.99",
                "status": DeviceStatusEnum.UNKNOWN.value,
                "agent_version": None,
                "cpu": None,
                "ram": None,
                "disk_tot": None,
                "disk_free": None,
                "local_users": ["root", "labuser"]
            }
        ]

        device_objects = []
        for dev_data in devices_data:
            dev = db.query(Device).filter(Device.organization_id == org.id, Device.asset_tag == dev_data["asset_tag"]).first()
            if not dev:
                dev = Device(
                    organization_id=org.id,
                    hostname=dev_data["hostname"],
                    display_name=dev_data["display_name"],
                    os_family=dev_data["os_family"],
                    os_version=dev_data["os_version"],
                    manufacturer=dev_data["manufacturer"],
                    model=dev_data["model"],
                    serial_number=dev_data["serial_number"],
                    asset_tag=dev_data["asset_tag"],
                    assigned_employee_id=emp_map[dev_data["emp_name"]].id if dev_data["emp_name"] in emp_map else None,
                    department_id=dept_map[dev_data["dept_name"]].id if dev_data["dept_name"] in dept_map else None,
                    local_ip=dev_data["local_ip"],
                    status=dev_data["status"],
                    last_seen_at=now - timedelta(minutes=5) if dev_data["status"] == DeviceStatusEnum.ONLINE.value else now - timedelta(days=2),
                    agent_version=dev_data["agent_version"],
                    is_demo=True
                )
                db.add(dev)
                db.commit()
                db.refresh(dev)

                # Add local accounts
                for uname in dev_data["local_users"]:
                    acc = DeviceAccount(
                        organization_id=org.id,
                        device_id=dev.id,
                        username=uname,
                        account_kind="LOCAL",
                        account_status="ACTIVE",
                        is_demo=True,
                        observed_at=now
                    )
                    db.add(acc)

                # Add telemetry point if available
                if dev_data["cpu"] is not None:
                    telem = DeviceTelemetry(
                        organization_id=org.id,
                        device_id=dev.id,
                        cpu_percent=dev_data["cpu"],
                        memory_percent=dev_data["ram"],
                        disk_total_gb=dev_data["disk_tot"],
                        disk_free_gb=dev_data["disk_free"],
                        is_demo=True,
                        recorded_at=now - timedelta(minutes=2)
                    )
                    db.add(telem)

                db.commit()

            device_objects.append(dev)

        # 6. Sample Simulated Commands and Audit Logs
        super_admin = admin_map[RoleEnum.SUPER_ADMIN.value]
        first_device = device_objects[0]

        existing_command = db.query(Command).filter(Command.organization_id == org.id, Command.device_id == first_device.id).first()
        if not existing_command:
            cmd = Command(
                organization_id=org.id,
                device_id=first_device.id,
                action_type=ActionTypeEnum.END_USER_SESSION.value,
                mode="SIMULATION",
                status=CommandStatusEnum.SUCCEEDED_SIMULATED.value,
                requested_by=super_admin.id,
                reason="Verificação preventiva de segurança na estação de trabalho.",
                result_message="Sessão simulada finalizada com sucesso no ambiente virtual Ublock.",
                completed_at=now - timedelta(hours=1)
            )
            db.add(cmd)
            db.commit()
            db.refresh(cmd)

            AuditService.log_event(
                db=db,
                organization_id=org.id,
                action="CREATE_SIMULATED_COMMAND:END_USER_SESSION",
                outcome="SUCCESS",
                actor_admin_id=super_admin.id,
                device_id=first_device.id,
                command_id=cmd.id,
                details={
                    "mode": "SIMULATION",
                    "safe_guard_note": "Ação estritamente simulada em banco de dados; nenhum comando de sistema operacional foi emitido.",
                    "reason": cmd.reason,
                }
            )

        print("[SUCESSO] Base de demonstração carregada com êxito! Todas as entidades foram associadas à organização de demonstração.")

    except Exception as exc:
        db.rollback()
        print(f"[FALHA] Erro ao carregar dados de demonstração: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
