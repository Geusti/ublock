import uuid
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.employee import Employee


def test_list_devices_empty(client, tech_headers):
    response = client.get("/api/v1/devices", headers=tech_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_create_device_as_technician(client, tech_headers):
    payload = {
        "hostname": "UB-DESK-01",
        "display_name": "Estação Designer",
        "os_family": "WINDOWS",
        "os_version": "Windows 11",
        "serial_number": "SN-BR-998811",
        "asset_tag": "TAG-2001",
        "local_ip": "192.168.1.50",
        "status": "ONLINE"
    }
    response = client.post("/api/v1/devices", json=payload, headers=tech_headers)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["hostname"] == "UB-DESK-01"
    assert data["asset_tag"] == "TAG-2001"
    assert data["serial_number"] == "SN-BR-998811"


def test_search_device_by_serial_number(client, tech_headers, sample_device):
    # Update sample_device with a serial number
    client.patch(
        f"/api/v1/devices/{sample_device.id}",
        json={"serial_number": "SERIAL-XYZ-999"},
        headers=tech_headers
    )

    res = client.get("/api/v1/devices?search=XYZ-999", headers=tech_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["serial_number"] == "SERIAL-XYZ-999"


def test_sort_devices_by_hostname(client, tech_headers, sample_device):
    # Create two more devices
    client.post(
        "/api/v1/devices",
        json={"hostname": "AAA-HOST", "display_name": "Alpha Host", "os_family": "LINUX"},
        headers=tech_headers
    )
    client.post(
        "/api/v1/devices",
        json={"hostname": "ZZZ-HOST", "display_name": "Zeta Host", "os_family": "LINUX"},
        headers=tech_headers
    )

    # Sort ASC
    res_asc = client.get("/api/v1/devices?sort_by=hostname&sort_dir=asc", headers=tech_headers)
    items_asc = res_asc.json()["items"]
    assert items_asc[0]["hostname"] == "AAA-HOST"
    assert items_asc[-1]["hostname"] == "ZZZ-HOST"

    # Sort DESC
    res_desc = client.get("/api/v1/devices?sort_by=hostname&sort_dir=desc", headers=tech_headers)
    items_desc = res_desc.json()["items"]
    assert items_desc[0]["hostname"] == "ZZZ-HOST"
    assert items_desc[-1]["hostname"] == "AAA-HOST"


def test_associate_and_disassociate_employee(client, db_session, org_a, tech_headers, sample_device):
    emp = Employee(
        organization_id=org_a.id,
        full_name="Carlos Operador",
        corporate_email="carlos@ubook.test"
    )
    db_session.add(emp)
    db_session.commit()
    db_session.refresh(emp)

    # 1. Associate employee
    res_assoc = client.patch(
        f"/api/v1/devices/{sample_device.id}",
        json={"assigned_employee_id": str(emp.id)},
        headers=tech_headers
    )
    assert res_assoc.status_code == status.HTTP_200_OK
    assert res_assoc.json()["assigned_employee_name"] == "Carlos Operador"

    # 2. Disassociate employee
    res_disassoc = client.patch(
        f"/api/v1/devices/{sample_device.id}",
        json={"assigned_employee_id": None},
        headers=tech_headers
    )
    assert res_disassoc.status_code == status.HTTP_200_OK
    assert res_disassoc.json()["assigned_employee_id"] is None
    assert res_disassoc.json()["assigned_employee_name"] is None


def test_create_device_as_viewer_forbidden(client, viewer_headers):
    payload = {
        "hostname": "UB-DESK-02",
        "display_name": "Estação Auditor",
        "os_family": "LINUX",
        "asset_tag": "TAG-2002"
    }
    response = client.post("/api/v1/devices", json=payload, headers=viewer_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_asset_tag_unique_constraint(client, tech_headers, sample_device):
    payload = {
        "hostname": "UB-DUPLICATE",
        "display_name": "Estação Duplicada",
        "os_family": "WINDOWS",
        "asset_tag": sample_device.asset_tag  # Same tag
    }
    response = client.post("/api/v1/devices", json=payload, headers=tech_headers)
    assert response.status_code == status.HTTP_409_CONFLICT
    assert "já está em uso" in response.json()["detail"]


def test_get_device_detail(client, tech_headers, sample_device):
    response = client.get(f"/api/v1/devices/{sample_device.id}", headers=tech_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(sample_device.id)
    assert len(data["accounts"]) == 1
    assert data["accounts"][0]["username"] == "john.doe"


def test_update_device(client, tech_headers, sample_device):
    payload = {"display_name": "Workstation Atualizada", "status": "ALERT"}
    response = client.patch(f"/api/v1/devices/{sample_device.id}", json=payload, headers=tech_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["display_name"] == "Workstation Atualizada"
    assert data["status"] == "ALERT"


def test_retire_device_soft_delete(client, tech_headers, sample_device):
    response = client.delete(f"/api/v1/devices/{sample_device.id}", headers=tech_headers)
    assert response.status_code == status.HTTP_200_OK

    # Device still exists, but status is RETIRED
    get_res = client.get(f"/api/v1/devices/{sample_device.id}", headers=tech_headers)
    assert get_res.json()["status"] == "RETIRED"
