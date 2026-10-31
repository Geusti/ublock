from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.device import Device, OSFamilyEnum, DeviceStatusEnum
from app.models.department import Department
from app.models.employee import Employee


def test_dashboard_summary_metrics_and_alerts(client, db_session, org_a, tech_headers):
    # Create departments
    dept1 = Department(organization_id=org_a.id, name="Engenharia")
    dept2 = Department(organization_id=org_a.id, name="Financeiro")
    db_session.add_all([dept1, dept2])
    db_session.commit()

    now = datetime.now(timezone.utc)

    # Device 1: Online (seen 2 mins ago)
    d1 = Device(
        organization_id=org_a.id,
        hostname="DEV-ENG-01",
        display_name="Dev Box 1",
        os_family=OSFamilyEnum.LINUX.value,
        department_id=dept1.id,
        status=DeviceStatusEnum.ONLINE.value,
        last_seen_at=now - timedelta(minutes=2)
    )

    # Device 2: Alert
    d2 = Device(
        organization_id=org_a.id,
        hostname="DEV-ALERT-01",
        display_name="Alert Workstation",
        os_family=OSFamilyEnum.WINDOWS.value,
        department_id=dept2.id,
        status=DeviceStatusEnum.ALERT.value,
        last_seen_at=now - timedelta(minutes=1)
    )

    # Device 3: Offline (seen 60 mins ago, threshold is 15 min)
    d3 = Device(
        organization_id=org_a.id,
        hostname="DEV-OFFLINE-01",
        display_name="Offline Box",
        os_family=OSFamilyEnum.WINDOWS.value,
        department_id=dept1.id,
        status=DeviceStatusEnum.ONLINE.value, # marked online in DB but last seen is old
        last_seen_at=now - timedelta(minutes=60)
    )

    # Device 4: Unknown (never seen)
    d4 = Device(
        organization_id=org_a.id,
        hostname="DEV-UNKNOWN-01",
        display_name="New Uncontacted PC",
        os_family=OSFamilyEnum.MACOS.value,
        status=DeviceStatusEnum.UNKNOWN.value,
        last_seen_at=None
    )

    db_session.add_all([d1, d2, d3, d4])
    db_session.commit()

    # Query Dashboard
    res = client.get("/api/v1/dashboard/summary", headers=tech_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["total_devices"] == 4
    assert data["online_devices"] == 1
    assert data["alert_devices"] == 1
    assert data["offline_devices"] == 1
    assert data["unknown_devices"] == 1

    # Check alert devices list
    assert len(data["alert_devices_list"]) == 1
    assert data["alert_devices_list"][0]["hostname"] == "DEV-ALERT-01"

    # Check department distribution
    dept_names = [d["department_name"] for d in data["department_distribution"]]
    assert "Engenharia" in dept_names
    assert "Financeiro" in dept_names
    assert "Sem Departamento" in dept_names
