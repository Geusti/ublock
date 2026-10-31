from fastapi import status


def test_audit_logs_recorded_and_listed(client, tech_headers, sample_device):
    # 1. Trigger an audited action (create a simulated command)
    client.post(
        f"/api/v1/devices/{sample_device.id}/commands",
        json={"action_type": "END_USER_SESSION", "reason": "Auditoria de rotina."},
        headers=tech_headers
    )

    # 2. Query audit logs
    response = client.get("/api/v1/audit-logs", headers=tech_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] >= 1
    recent = data["items"][0]
    assert "END_USER_SESSION" in recent["action"]
    assert recent["outcome"] == "PENDING_SIMULATED"
    assert recent["actor_admin_name"] == "Técnico de Suporte"


def test_audit_logs_immutable_no_delete(client, tech_headers):
    # Verify no DELETE or PUT endpoints exist on audit-logs
    res_del = client.delete("/api/v1/audit-logs", headers=tech_headers)
    assert res_del.status_code in [status.HTTP_405_METHOD_NOT_ALLOWED, status.HTTP_404_NOT_FOUND]
