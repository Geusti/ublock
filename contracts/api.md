# Contrato inicial da API — `/api/v1`

Todos os endpoints privados exigem autenticação e autorização no backend. O contexto da organização vem da sessão autenticada, nunca de um valor confiado enviado pelo cliente.

## Auth
- `POST /auth/login` — autentica administrador.
- `POST /auth/logout` — encerra sessão.
- `GET /auth/me` — usuário e papel atuais.

## Dashboard
- `GET /dashboard/summary`
  - Retorna totais de ativos por status, alertas e comandos simulados pendentes.
  - Diferenciar explicitamente dados demo de dados coletados de agentes reais.

## Devices
- `GET /devices?search=&os_family=&status=&department_id=&page=1&page_size=20`
- `POST /devices`
- `GET /devices/{device_id}`
- `PATCH /devices/{device_id}`
- `GET /devices/{device_id}/accounts`
- `GET /devices/{device_id}/telemetry`

## Employees and departments
- `GET /employees?search=&department_id=&status=&page=1&page_size=20`
- `POST /employees`
- `GET /employees/{employee_id}`
- `PATCH /employees/{employee_id}`
- `GET /departments`
- `POST /departments`
- `PATCH /departments/{department_id}`

## Commands (simulation only)
- `GET /commands?status=&device_id=&page=1&page_size=20`
- `POST /devices/{device_id}/commands`
- `POST /commands/{command_id}/simulate-result`

Allowed action types:
- `SUSPEND_LOCAL_ACCOUNT`
- `REACTIVATE_LOCAL_ACCOUNT`
- `END_USER_SESSION`
- `ISOLATE_DEVICE_NETWORK`
- `EMERGENCY_LOCKDOWN`

Every command created by MVP 1 must use `mode=SIMULATION`. No OS commands are executed.

## Audit
- `GET /audit-logs?from=&to=&actor_id=&device_id=&action_type=&page=1&page_size=20`

## Health
- `GET /health` — health check that does not expose secrets or infrastructure details.
