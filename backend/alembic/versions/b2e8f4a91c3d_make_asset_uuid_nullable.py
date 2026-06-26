"""make asset servicem8_uuid nullable for manual assets

Revision ID: b2e8f4a91c3d
Revises: a3f9c1d72e05
Create Date: 2026-06-26 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2e8f4a91c3d'
down_revision: Union[str, None] = 'a3f9c1d72e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('assets', 'servicem8_asset_uuid', existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    op.alter_column('assets', 'servicem8_asset_uuid', existing_type=sa.String(255), nullable=False)
