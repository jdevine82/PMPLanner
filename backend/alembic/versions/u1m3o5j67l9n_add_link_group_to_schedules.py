"""add link_group to maintenance_schedules

Revision ID: u1m3o5j67l9n
Revises: t0l2n4i56k8m
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'u1m3o5j67l9n'
down_revision: Union[str, None] = 't0l2n4i56k8m'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('maintenance_schedules', sa.Column('link_group', sa.String(100), nullable=True))
    op.create_index('ix_maintenance_schedules_link_group', 'maintenance_schedules', ['link_group'])


def downgrade() -> None:
    op.drop_index('ix_maintenance_schedules_link_group', 'maintenance_schedules')
    op.drop_column('maintenance_schedules', 'link_group')
