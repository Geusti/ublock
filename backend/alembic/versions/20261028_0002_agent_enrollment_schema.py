"""Agent Enrollment and Monitoring Schema

Revision ID: 20261028_0002
Revises: 20261028_0001
Create Date: 2026-10-28 17:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261028_0002'
down_revision: Union[str, None] = '20261028_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. device_enrollment_tokens
    op.create_table(
        'device_enrollment_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['admin_users.id']),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_device_enrollment_tokens_organization_id', 'device_enrollment_tokens', ['organization_id'])
    op.create_index('ix_device_enrollment_tokens_device_id', 'device_enrollment_tokens', ['device_id'])
    op.create_index('idx_enrollment_token_hash', 'device_enrollment_tokens', ['token_hash'])
    op.create_index('idx_enrollment_device', 'device_enrollment_tokens', ['device_id'])

    # 2. device_agents
    op.create_table(
        'device_agents',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('device_id', sa.Uuid(), nullable=False),
        sa.Column('agent_uuid', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('agent_version', sa.String(length=40), nullable=False, default='1.0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, default='REGISTERED'),
        sa.Column('last_heartbeat_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_inventory_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('uptime_seconds', sa.Integer(), nullable=True),
        sa.Column('last_error', sa.String(length=500), nullable=True),
        sa.Column('hardware_info', sa.JSON(), nullable=False, default=dict),
        sa.Column('registered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id')
    )
    op.create_index('ix_device_agents_organization_id', 'device_agents', ['organization_id'])
    op.create_index('ix_device_agents_device_id', 'device_agents', ['device_id'])
    op.create_index('ix_device_agents_agent_uuid', 'device_agents', ['agent_uuid'])
    op.create_index('idx_device_agents_token_hash', 'device_agents', ['token_hash'])


def downgrade() -> None:
    op.drop_table('device_agents')
    op.drop_table('device_enrollment_tokens')
