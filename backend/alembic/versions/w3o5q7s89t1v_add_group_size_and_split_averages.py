"""add group_size to job_instances and split labor averages on service_templates

Revision ID: w3o5q7s89t1v
Revises: v2n4p6r78s0u
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'w3o5q7s89t1v'
down_revision: Union[str, None] = 'v2n4p6r78s0u'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('job_instances', sa.Column('group_size', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('service_templates', sa.Column('historical_average_labor_hours_solo', sa.Numeric(5, 2), nullable=False, server_default='0.00'))
    op.add_column('service_templates', sa.Column('historical_average_labor_hours_combined', sa.Numeric(5, 2), nullable=False, server_default='0.00'))


def downgrade() -> None:
    op.drop_column('job_instances', 'group_size')
    op.drop_column('service_templates', 'historical_average_labor_hours_solo')
    op.drop_column('service_templates', 'historical_average_labor_hours_combined')
