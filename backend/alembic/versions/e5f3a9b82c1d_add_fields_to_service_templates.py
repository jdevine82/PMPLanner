"""add job_description, work_completed, attachments, job_badges to service_templates

Revision ID: e5f3a9b82c1d
Revises: d4f2e8b91a7c
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f3a9b82c1d'
down_revision = 'd4f2e8b91a7c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('service_templates', sa.Column('job_description', sa.Text, nullable=True))
    op.add_column('service_templates', sa.Column('work_completed', sa.Text, nullable=True))
    op.add_column('service_templates', sa.Column('attachments', sa.JSON, nullable=True))
    op.add_column('service_templates', sa.Column('job_badges', sa.JSON, nullable=True))


def downgrade() -> None:
    op.drop_column('service_templates', 'job_badges')
    op.drop_column('service_templates', 'attachments')
    op.drop_column('service_templates', 'work_completed')
    op.drop_column('service_templates', 'job_description')
