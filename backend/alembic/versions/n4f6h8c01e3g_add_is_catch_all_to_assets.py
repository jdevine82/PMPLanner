"""add is_catch_all to assets

Revision ID: n4f6h8c01e3g
Revises: m3e5g7b90d2f
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'n4f6h8c01e3g'
down_revision = 'm3e5g7b90d2f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assets', sa.Column('is_catch_all', sa.Boolean, nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('assets', 'is_catch_all')
