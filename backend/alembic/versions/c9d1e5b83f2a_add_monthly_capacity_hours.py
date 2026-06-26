"""add monthly_capacity_hours to app_settings

Revision ID: c9d1e5b83f2a
Revises: b2e8f4a91c3d
Create Date: 2026-06-26 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d1e5b83f2a'
down_revision: Union[str, None] = 'b2e8f4a91c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('app_settings', sa.Column('monthly_capacity_hours', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('app_settings', 'monthly_capacity_hours')
