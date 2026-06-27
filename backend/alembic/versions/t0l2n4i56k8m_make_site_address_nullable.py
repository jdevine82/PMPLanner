"""make site address optional

Revision ID: t0l2n4i56k8m
Revises: s9k1m3h45j7l
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 't0l2n4i56k8m'
down_revision: Union[str, None] = 's9k1m3h45j7l'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('sites', 'site_address', existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    op.alter_column('sites', 'site_address', existing_type=sa.Text(), nullable=False)
