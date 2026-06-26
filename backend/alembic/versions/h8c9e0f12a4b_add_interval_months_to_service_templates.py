"""add interval_months to service_templates

Revision ID: h8c9e0f12a4b
Revises: f6a7c8d91e2b
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'h8c9e0f12a4b'
down_revision = 'f6a7c8d91e2b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('service_templates', sa.Column('interval_months', sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column('service_templates', 'interval_months')
