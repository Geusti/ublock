from fastapi import status
from app.models.device import Device, OSFamilyEnum, DeviceStatusEnum
from app.models.admin_user import AdminUser, RoleEnum
from app.core.security import get_password_hash, create_access_token


def test_multi_tenant_device_isolation_and_idor_prevention(client, db_session, org_a, org_b, tech_headers):
    # 1. Create a device belonging to Org B
    device_b = Device(
        organization_id=org_b.id,
        hostname="ORG-B-SERVER-01",
        display_name="Servidor Secreto Org B",
        os_family=OSFamilyEnum.LINUX.value,
        asset_tag="ORG-B-TAG-999",
        status=DeviceStatusEnum.ONLINE.value
    )
    db_session.add(device_b)
    db_session.commit()
    db_session.refresh(device_b)

    # 2. Admin from Org A tries to list devices -> must NOT see device_b
    list_res = client.get("/api/v1/devices", headers=tech_headers)
    assert list_res.status_code == status.HTTP_200_OK
    items = list_res.json()["items"]
    assert not any(item["id"] == str(device_b.id) for item in items)
    assert not any(item["hostname"] == "ORG-B-SERVER-01" for item in items)

    # 3. Admin from Org A attempts direct IDOR access to device_b -> must return 404
    get_res = client.get(f"/api/v1/devices/{device_b.id}", headers=tech_headers)
    assert get_res.status_code == status.HTTP_404_NOT_FOUND

    # 4. Admin from Org A attempts to send a command to device_b -> must return 404
    cmd_res = client.post(
        f"/api/v1/devices/{device_b.id}/commands",
        json={"action_type": "ISOLATE_DEVICE_NETWORK", "reason": "Tentativa de IDOR."},
        headers=tech_headers
    )
    assert cmd_res.status_code == status.HTTP_404_NOT_FOUND


def test_dashboard_summary_isolation(client, db_session, org_b, tech_headers):
    # Add 5 devices to Org B
    for i in range(5):
        dev = Device(
            organization_id=org_b.id,
            hostname=f"DEV-B-{i}",
            display_name=f"Device B {i}",
            os_family=OSFamilyEnum.WINDOWS.value,
            status=DeviceStatusEnum.ONLINE.value
        )
        db_session.add(dev)
    db_session.commit()

    # Query dashboard summary for Org A
    dash_res = client.get("/api/v1/dashboard/summary", headers=tech_headers)
    assert dash_res.status_code == status.HTTP_200_OK
    # Should not count Org B devices
    assert dash_res.json()["total_devices"] == 0
