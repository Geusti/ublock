from fastapi import status


def test_create_and_list_department(client, tech_headers):
    payload = {"name": "Tecnologia e Inovação", "is_active": True}
    res = client.post("/api/v1/departments", json=payload, headers=tech_headers)
    assert res.status_code == status.HTTP_201_CREATED
    dept_id = res.json()["id"]

    list_res = client.get("/api/v1/departments", headers=tech_headers)
    assert list_res.status_code == status.HTTP_200_OK
    assert any(d["id"] == dept_id for d in list_res.json())


def test_create_employee_with_department(client, tech_headers):
    # 1. Create department
    dept_res = client.post("/api/v1/departments", json={"name": "Operações"}, headers=tech_headers)
    dept_id = dept_res.json()["id"]

    # 2. Create employee
    payload = {
        "full_name": "Maria Silva",
        "corporate_email": "maria.silva@ubook.test",
        "department_id": dept_id,
        "status": "ACTIVE",
        "notes": "Coordenadora de Projetos"
    }
    emp_res = client.post("/api/v1/employees", json=payload, headers=tech_headers)
    assert emp_res.status_code == status.HTTP_201_CREATED
    data = emp_res.json()
    assert data["full_name"] == "Maria Silva"
    assert data["department_name"] == "Operações"


def test_employee_assigned_devices_detail(client, tech_headers, sample_device):
    # 1. Create employee
    emp_res = client.post(
        "/api/v1/employees",
        json={"full_name": "Lucas Designer", "corporate_email": "lucas.des@ubook.test"},
        headers=tech_headers
    )
    emp_id = emp_res.json()["id"]

    # 2. Assign sample device to this employee
    client.patch(
        f"/api/v1/devices/{sample_device.id}",
        json={"assigned_employee_id": emp_id},
        headers=tech_headers
    )

    # 3. Fetch employee detail and verify assigned_devices list
    detail_res = client.get(f"/api/v1/employees/{emp_id}", headers=tech_headers)
    assert detail_res.status_code == status.HTTP_200_OK
    detail_data = detail_res.json()
    assert detail_data["device_count"] == 1
    assert len(detail_data["assigned_devices"]) == 1
    assert detail_data["assigned_devices"][0]["id"] == str(sample_device.id)
    assert detail_data["assigned_devices"][0]["hostname"] == sample_device.hostname


def test_cannot_assign_to_inactive_department(client, tech_headers):
    # 1. Create department and inactivate it
    dept_res = client.post("/api/v1/departments", json={"name": "Dep Desativado", "is_active": True}, headers=tech_headers)
    dept_id = dept_res.json()["id"]
    client.patch(f"/api/v1/departments/{dept_id}", json={"is_active": False}, headers=tech_headers)

    # 2. Try to create employee in this inactive department -> must return 400
    res = client.post(
        "/api/v1/employees",
        json={"full_name": "Func Inválido", "department_id": dept_id},
        headers=tech_headers
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "inativo" in res.json()["detail"]


def test_safe_department_deletion_logic(client, tech_headers, sample_device):
    # 1. Create department and link to sample_device
    dept_res = client.post("/api/v1/departments", json={"name": "Setor com Ativo"}, headers=tech_headers)
    dept_id = dept_res.json()["id"]
    client.patch(f"/api/v1/devices/{sample_device.id}", json={"department_id": dept_id}, headers=tech_headers)

    # 2. Delete department -> should logically deactivate, not hard delete
    del_res = client.delete(f"/api/v1/departments/{dept_id}", headers=tech_headers)
    assert del_res.status_code == status.HTTP_200_OK
    assert "desativado logicamente" in del_res.json()["message"]

    # Verify department is still there but is_active = False
    get_dept = client.get(f"/api/v1/departments/{dept_id}", headers=tech_headers)
    assert get_dept.status_code == status.HTTP_200_OK
    assert get_dept.json()["is_active"] is False


def test_viewer_cannot_create_employee(client, viewer_headers):
    payload = {"full_name": "Teste Viewer", "corporate_email": "teste@ubook.test"}
    res = client.post("/api/v1/employees", json=payload, headers=viewer_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN
