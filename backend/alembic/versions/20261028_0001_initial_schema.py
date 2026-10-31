"""Initial Ublock Schema Migration

Revision ID: 20261028_0001
Revises: 
Create Date: 2026-10-28 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261028_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)

    # 2. admin_users
    op.create_table(
        'admin_users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=160), nullable=False),
        sa.Column('role', sa.String(length=24), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'email', name='uq_admin_user_org_email')
    )
    op.create_index('ix_admin_users_organization_id', 'admin_users', ['organization_id'])

    # 3. departments
    op.create_table(
        'departments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'name', name='uq_department_org_name')
    )
    op.create_index('ix_departments_organization_id', 'departments', ['organization_id'])

    # 4. employees
    op.create_table(
        'employees',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('department_id', sa.Uuid(), nullable=True),
        sa.Column('full_name', sa.String(length=160), nullable=False),
        sa.Column('corporate_email', sa.String(length=254), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='ACTIVE'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_employees_organization_id', 'employees', ['organization_id'])
    op.create_index('ix_employees_status', 'employees', ['status'])

    # 5. devices
    op.create_table(
        'devices',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('hostname', sa.String(length=160), nullable=False),
        sa.Column('display_name', sa.String(length=160), nullable=False),
        sa.Column('os_family', sa.String(length=20), nullable=False),
        sa.Column('os_version', sa.String(length=120), nullable=True),
        sa.Column('manufacturer', sa.String(length=120), nullable=True),
        sa.Column('model', sa.String(length=120), nullable=True),
        sa.Column('serial_number', sa.String(length=160), nullable=True),
        sa.Column('asset_tag', sa.String(length=100), nullable=True),
        sa.Column('assigned_employee_id', sa.Uuid(), nullable=True),
        sa.Column('department_id', sa.Uuid(), nullable=True),
        sa.Column('local_ip', sa.String(length=45), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, default='UNKNOWN'),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('agent_version', sa.String(length=40), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['assigned_employee_id'], ['employees.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'asset_tag', name='uq_device_org_asset_tag')
    )
    op.create_index('ix_devices_organization_id', 'devices', ['organization_id'])
    op.create_index('idx_devices_org_status', 'devices', ['organization_id', 'status'])
    op.create_index('idx_devices_org_hostname', 'devices', ['organization_id', 'hostname'])

    # 6. device_accounts
    op.create_table(
        'device_accounts',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('username', sa.String(length=160), nullable=False),
        sa.Column('account_kind', sa.String(length=30), nullable=False, default='LOCAL'),
        sa.Column('account_status', sa.String(length=20), nullable=False, default='ACTIVE'),
        sa.Column('is_demo', sa.Boolean(), nullable=False, default=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_device_accounts_organization_id', 'device_accounts', ['organization_id'])
    op.create_index('ix_device_accounts_device_id', 'device_accounts', ['device_id'])

    # 7. device_telemetry
    op.create_table(
        'device_telemetry',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('cpu_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('memory_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('disk_total_gb', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('disk_free_gb', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, default=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_device_telemetry_organization_id', 'device_telemetry', ['organization_id'])
    op.create_index('ix_device_telemetry_device_id', 'device_telemetry', ['device_id'])
    op.create_index('idx_telemetry_device_time', 'device_telemetry', ['device_id', 'recorded_at'])

    # 8. commands
    op.create_table(
        'commands',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('target_account_id', sa.Uuid(), nullable=True),
        sa.Column('action_type', sa.String(length=40), nullable=False),
        sa.Column('mode', sa.String(length=20), nullable=False, default='SIMULATION'),
        sa.Column('status', sa.String(length=30), nullable=False, default='PENDING'),
        sa.Column('requested_by', sa.Uuid(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('result_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['admin_users.id']),
        sa.ForeignKeyConstraint(['target_account_id'], ['device_accounts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_commands_organization_id', 'commands', ['organization_id'])
    op.create_index('ix_commands_device_id', 'commands', ['device_id'])
    op.create_index('idx_commands_org_status', 'commands', ['organization_id', 'status'])

    # 9. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('actor_admin_id', sa.Uuid(), nullable=True),
        sa.Column('device_id', sa.Uuid(), nullable=True),
        sa.Column('command_id', sa.Uuid(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('outcome', sa.String(length=40), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_admin_id'], ['admin_users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['command_id'], ['commands.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_organization_id', 'audit_logs', ['organization_id'])
    op.create_index('idx_audit_org_time', 'audit_logs', ['organization_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('commands')
    op.drop_table('device_telemetry')
    op.drop_table('device_accounts')
    op.drop_table('devices')
    op.drop_table('employees')
    op.drop_table('departments')
    op.drop_table('admin_users')
    op.drop_table('organizations')
