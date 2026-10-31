from fastapi import status


def test_create_simulated_command_as_technician(client, tech_headers, sample_device):
    payload = {
        "action_type": "SUSPEND_LOCAL_ACCOUNT",
        "target_account_id": str(sample_device.accounts[0].id),
        "reason": "Suspensão temporária para auditoria de segurança."
    }
    response = client.post(
        f"/api/v1/devices/{sample_device.id}/commands",
        json=payload,
        headers=tech_headers
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["mode"] == "SIMULATION"
    assert data["status"] == "PENDING"
    assert data["action_type"] == "SUSPEND_LOCAL_ACCOUNT"
    assert data["device_id"] == str(sample_device.id)


def test_viewer_cannot_create_command(client, viewer_headers, sample_device):
    payload = {
        "action_type": "EMERGENCY_LOCKDOWN",
        "reason": "Tentativa indevida de bloqueio por visualizador."
    }
    response = client.post(
        f"/api/v1/devices/{sample_device.id}/commands",
        json=payload,
        headers=viewer_headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_simulate_command_success_flow(client, tech_headers, sample_device):
    # 1. Enqueue simulated command
    create_res = client.post(
        f"/api/v1/devices/{sample_device.id}/commands",
        json={
            "action_type": "SUSPEND_LOCAL_ACCOUNT",
            "target_account_id": str(sample_device.accounts[0].id),
            "reason": "Teste de contenção virtual."
        },
        headers=tech_headers
    )
    cmd_id = create_res.json()["id"]

    # 2. Simulate result
    sim_res = client.post(
        f"/api/v1/commands/{cmd_id}/simulate-result",
        json={"succeeded": True, "result_message": "Conta suspensa com sucesso no ambiente simulado."},
        headers=tech_headers
    )
    assert sim_res.status_code == status.HTTP_200_OK
    sim_data = sim_res.json()
    assert sim_data["status"] == "SUCCEEDED_SIMULATED"
    assert sim_data["completed_at"] is not None

    # 3. Verify that account reflects simulated status
    acc_res = client.get(f"/api/v1/devices/{sample_device.id}/accounts", headers=tech_headers)
    assert acc_res.status_code == status.HTTP_200_OK
    assert acc_res.json()[0]["account_status"] == "SUSPENDED"


def test_list_commands(client, tech_headers, sample_device):
    # Create command first
    client.post(
        f"/api/v1/devices/{sample_device.id}/commands",
        json={"action_type": "ISOLATE_DEVICE_NETWORK", "reason": "Isolamento simulado."},
        headers=tech_headers
    )
    res = client.get("/api/v1/commands", headers=tech_headers)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["total"] >= 1
