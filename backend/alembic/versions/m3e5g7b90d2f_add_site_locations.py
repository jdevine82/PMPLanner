"""add site_locations table and location_id to assets

Revision ID: m3e5g7b90d2f
Revises: k2d4f6a89c1e
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'm3e5g7b90d2f'
down_revision = 'k2d4f6a89c1e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'site_locations',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('site_id', sa.Integer, sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column('assets', sa.Column('location_id', sa.Integer, sa.ForeignKey('site_locations.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('assets', 'location_id')
    op.drop_table('site_locations')
