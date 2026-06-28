"""add parent_id to site_locations for nested sublocations

Revision ID: v2n4p6r78s0u
Revises: u1m3o5j67l9n
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'v2n4p6r78s0u'
down_revision: Union[str, None] = 'u1m3o5j67l9n'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_locations', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_site_locations_parent_id',
        'site_locations', 'site_locations',
        ['parent_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_site_locations_parent_id', 'site_locations', type_='foreignkey')
    op.drop_column('site_locations', 'parent_id')
