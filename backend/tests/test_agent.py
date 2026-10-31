import uuid
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.device_agent import DeviceEnrollmentToken, DeviceAgent, AgentStatusEnum
from app.api.agent_deps import hash_token


def test_generate_enrollment_token(client, tech_headers, sample_device):
    res = client.post(
        f"/api/v1/devices/{sample_device.id}/enrollment-token",
        json={"expires_in_hours": 12},
        headers=tech_headers
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "enrollment_token" in data
    assert data["enrollment_token"].startswith("ublock_enr_")
    assert data["device_id"] == str(sample_device.id)
    assert "installation_command" in data


def test_agent_enrollment_success(client, db_session, org_a, super_admin, sample_device):
    # 1. Create a valid enrollment token in DB
    raw_token = "test_valid_token_1234567890"
    t_hash = hash_token(raw_token)
    token_record = DeviceEnrollmentToken(
        organization_id=org_a.id,
        device_id=sample_device.id,
        token_hash=t_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        created_by=super_admin.id
    )
    db_session.add(token_record)
    db_session.commit()

    agent_uuid = str(uuid.uuid4())

    # 2. Agent submits enrollment
    res = client.post(
        "/api/v1/agent/enroll",
        json={
            "enrollment_token": raw_token,
            "agent_uuid": agent_uuid,
            "agent_version": "1.0.0",
            "hostname": "TEST-WIN-01",
            "os_family": "WINDOWS",
            "os_version": "Windows 11 Pro 23H2",
            "architecture": "amd64"
        }
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "agent_key" in data
    assert data["agent_key"].startswith("ublock_ak_")
    assert data["device_id"] == str(sample_device.id)

    # 3. Verify token was marked as used (cannot be reused)
    res_reuse = client.post(
        "/api/v1/agent/enroll",
        json={
            "enrollment_token": raw_token,
            "agent_uuid": str(uuid.uuid4()),
            "agent_version": "1.0.0",
            "hostname": "TEST-WIN-02",
            "os_family": "WINDOWS",
            "architecture": "amd64"
        }
    )
    assert res_reuse.status_code == status.HTTP_400_BAD_REQUEST
    assert "já foi utilizado" in res_reuse.json()["detail"]


def test_agent_enrollment_expired_rejected(client, db_session, org_a, super_admin, sample_device):
    raw_token = "test_expired_token_00000000"
    token_record = DeviceEnrollmentToken(
        organization_id=org_a.id,
        device_id=sample_device.id,
        token_hash=hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1), # Expired!
        created_by=super_admin.id
    )
    db_session.add(token_record)
    db_session.commit()

    res = client.post(
        "/api/v1/agent/enroll",
        json={
            "enrollment_token": raw_token,
            "agent_uuid": str(uuid.uuid4()),
            "agent_version": "1.0.0",
            "hostname": "TEST-WIN-EXPIRED",
            "os_family": "WINDOWS",
            "architecture": "amd64"
        }
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "expirou" in res.json()["detail"]


def test_agent_heartbeat_and_status(client, db_session, org_a, sample_device, tech_headers):
    # 1. Setup registered agent in DB
    agent_key = "secret_agent_key_abc_123"
    agent_uuid = uuid.uuid4()
    agent = DeviceAgent(
        organization_id=org_a.id,
        device_id=sample_device.id,
        agent_uuid=agent_uuid,
        token_hash=hash_token(agent_key),
        agent_version="1.0.0",
        status=AgentStatusEnum.REGISTERED.value,
        registered_at=datetime.now(timezone.utc)
    )
    db_session.add(agent)
    db_session.commit()

    # 2. Heartbeat with valid header
    res = client.post(
        "/api/v1/agent/heartbeat",
        json={
            "agent_uuid": str(agent_uuid),
            "uptime_seconds": 12500,
            "agent_version": "1.0.1",
            "error_message": None
        },
        headers={"X-Agent-Key": agent_key}
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "ACK"

    # 3. Verify device status is now ONLINE
    dev_res = client.get(f"/api/v1/devices/{sample_device.id}", headers=tech_headers)
    assert dev_res.status_code == status.HTTP_200_OK
    assert dev_res.json()["status"] == "ONLINE"

    # 4. Heartbeat with invalid key -> 401
    res_bad = client.post(
        "/api/v1/agent/heartbeat",
        json={"agent_uuid": str(agent_uuid)},
        headers={"X-Agent-Key": "wrong_key"}
    )
    assert res_bad.status_code == status.HTTP_401_UNAUTHORIZED


def test_agent_technical_inventory(client, db_session, org_a, sample_device):
    agent_key = "inventory_test_key_xyz_999"
    agent_uuid = uuid.uuid4()
    agent = DeviceAgent(
        organization_id=org_a.id,
        device_id=sample_device.id,
        agent_uuid=agent_uuid,
        token_hash=hash_token(agent_key),
        agent_version="1.0.0",
        status=AgentStatusEnum.REGISTERED.value
    )
    db_session.add(agent)
    db_session.commit()

    payload = {
        "agent_uuid": str(agent_uuid),
        "cpu": {
            "model": "13th Gen Intel(R) Core(TM) i7-13700H",
            "cores": 14,
            "usage_percent": 18.5
        },
        "memory": {
            "total_bytes": 34359738368, # 32 GB
            "available_bytes": 17179869184, # 16 GB
            "usage_percent": 50.0
        },
        "storage": [
            {
                "drive": "C:",
                "total_bytes": 512000000000,
                "free_bytes": 256000000000,
                "fs_type": "NTFS"
            }
        ],
        "network": [
            {
                "interface_name": "Ethernet",
                "ip_address": "192.168.1.188",
                "mac_address": "00:1A:2B:3C:4D:5E"
            }
        ],
        "os_details": {
            "name": "Windows 11 Pro",
            "version": "10.0.22631",
            "build": "22631",
            "arch": "amd64"
        },
        "manufacturer": "Dell Inc.",
        "model": "Precision 5570",
        "serial_number": "SN-DELL-9988",
        "uptime_seconds": 86400
    }

    res = client.post(
        "/api/v1/agent/inventory",
        json=payload,
        headers={"X-Agent-Key": agent_key}
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "SUCCESS"

    # Verify device was updated
    db_session.refresh(sample_device)
    assert sample_device.manufacturer == "Dell Inc."
    assert sample_device.model == "Precision 5570"
    assert sample_device.serial_number == "SN-DELL-9988"
    assert sample_device.local_ip == "192.168.1.188"
    assert sample_device.is_demo is False


def test_agent_revocation(client, db_session, org_a, sample_device, tech_headers):
    agent_key = "revoke_test_key_001"
    agent_uuid = uuid.uuid4()
    agent = DeviceAgent(
        organization_id=org_a.id,
        device_id=sample_device.id,
        agent_uuid=agent_uuid,
        token_hash=hash_token(agent_key),
        agent_version="1.0.0",
        status=AgentStatusEnum.REGISTERED.value
    )
    db_session.add(agent)
    db_session.commit()

    # 1. Revoke agent via Admin API
    res_revoke = client.post(
        f"/api/v1/devices/{sample_device.id}/agent/revoke",
        headers=tech_headers
    )
    assert res_revoke.status_code == status.HTTP_200_OK
    assert "revogado com sucesso" in res_revoke.json()["message"]

    # 2. Agent attempts heartbeat -> must return 403 Forbidden
    res_hb = client.post(
        "/api/v1/agent/heartbeat",
        json={"agent_uuid": str(agent_uuid)},
        headers={"X-Agent-Key": agent_key}
    )
    assert res_hb.status_code == status.HTTP_403_FORBIDDEN
    assert "revogado" in res_hb.json()["detail"]
