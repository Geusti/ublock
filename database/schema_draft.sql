-- Esquema lógico inicial PostgreSQL. A implementação deve usar Alembic
-- como fonte canônica das migrações e adaptar este rascunho aos models ORM.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    role VARCHAR(24) NOT NULL CHECK (role IN ('SUPER_ADMIN','TECHNICIAN','VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, email)
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    department_id UUID REFERENCES departments(id),
    full_name VARCHAR(160) NOT NULL,
    corporate_email VARCHAR(254),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    notes TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    hostname VARCHAR(160) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    os_family VARCHAR(20) NOT NULL CHECK (os_family IN ('WINDOWS','LINUX','MACOS','OTHER')),
    os_version VARCHAR(120),
    manufacturer VARCHAR(120),
    model VARCHAR(120),
    serial_number VARCHAR(160),
    asset_tag VARCHAR(100),
    assigned_employee_id UUID REFERENCES employees(id),
    department_id UUID REFERENCES departments(id),
    local_ip INET,
    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('ONLINE','OFFLINE','ALERT','UNKNOWN','RETIRED')),
    last_seen_at TIMESTAMPTZ,
    agent_version VARCHAR(40),
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, asset_tag)
);

CREATE TABLE device_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    device_id UUID NOT NULL REFERENCES devices(id),
    username VARCHAR(160) NOT NULL,
    account_kind VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    account_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    observed_at TIMESTAMPTZ
);

CREATE TABLE device_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    device_id UUID NOT NULL REFERENCES devices(id),
    cpu_percent NUMERIC(5,2),
    memory_percent NUMERIC(5,2),
    disk_total_gb NUMERIC(12,2),
    disk_free_gb NUMERIC(12,2),
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    device_id UUID NOT NULL REFERENCES devices(id),
    target_account_id UUID REFERENCES device_accounts(id),
    action_type VARCHAR(40) NOT NULL CHECK (action_type IN (
        'SUSPEND_LOCAL_ACCOUNT','REACTIVATE_LOCAL_ACCOUNT',
        'END_USER_SESSION','ISOLATE_DEVICE_NETWORK','EMERGENCY_LOCKDOWN'
    )),
    mode VARCHAR(20) NOT NULL DEFAULT 'SIMULATION' CHECK (mode = 'SIMULATION'),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING','SUCCEEDED_SIMULATED','FAILED_SIMULATED'
    )),
    requested_by UUID NOT NULL REFERENCES admin_users(id),
    reason TEXT,
    result_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_admin_id UUID REFERENCES admin_users(id),
    device_id UUID REFERENCES devices(id),
    command_id UUID REFERENCES commands(id),
    action VARCHAR(100) NOT NULL,
    outcome VARCHAR(40) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_org_status ON devices (organization_id, status);
CREATE INDEX idx_devices_org_hostname ON devices (organization_id, hostname);
CREATE INDEX idx_employees_org_status ON employees (organization_id, status);
CREATE INDEX idx_telemetry_device_time ON device_telemetry (device_id, recorded_at DESC);
CREATE INDEX idx_commands_org_status ON commands (organization_id, status);
CREATE INDEX idx_audit_org_time ON audit_logs (organization_id, created_at DESC);
