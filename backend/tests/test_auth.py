from fastapi import status


def test_login_success(client, super_admin):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@ubook.test", "password": "SecretPass123!"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_login_wrong_password(client, super_admin):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@ubook.test", "password": "WrongPassword!"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Credenciais inválidas" in response.json()["detail"]


def test_login_unknown_user(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@example.com", "password": "SecretPass123!"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_me_success(client, super_admin_headers):
    response = client.get("/api/v1/auth/me", headers=super_admin_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["email"] == "superadmin@ubook.test"
    assert data["role"] == "SUPER_ADMIN"
    assert data["organization_slug"] == "ubook-matriz"


def test_get_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout(client, super_admin_headers):
    response = client.post("/api/v1/auth/logout", headers=super_admin_headers)
    assert response.status_code == status.HTTP_200_OK
    assert "finalizada com sucesso" in response.json()["message"]
