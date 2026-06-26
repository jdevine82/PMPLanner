"""add business_name and logo_filename to app_settings

Revision ID: d4f2e8b91a7c
Revises: c9d1e5b83f2a
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4f2e8b91a7c'
down_revision = 'c9d1e5b83f2a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_settings', sa.Column('business_name', sa.String(255), nullable=True))
    op.add_column('app_settings', sa.Column('logo_filename', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('app_settings', 'logo_filename')
    op.drop_column('app_settings', 'business_name')
