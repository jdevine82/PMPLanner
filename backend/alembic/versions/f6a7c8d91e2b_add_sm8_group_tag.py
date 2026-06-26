"""add sm8_group_tag to maintenance_schedules, drop unique on job_instances.servicem8_job_uuid

Revision ID: f6a7c8d91e2b
Revises: e5f3a9b82c1d
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7c8d91e2b'
down_revision = 'e5f3a9b82c1d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('maintenance_schedules', sa.Column('sm8_group_tag', sa.String(100), nullable=True))
    op.drop_constraint('job_instances_servicem8_job_uuid_key', 'job_instances', type_='unique')
    op.create_index('ix_job_instances_servicem8_job_uuid', 'job_instances', ['servicem8_job_uuid'])


def downgrade() -> None:
    op.drop_index('ix_job_instances_servicem8_job_uuid', table_name='job_instances')
    op.create_unique_constraint('job_instances_servicem8_job_uuid_key', 'job_instances', ['servicem8_job_uuid'])
    op.drop_column('maintenance_schedules', 'sm8_group_tag')
