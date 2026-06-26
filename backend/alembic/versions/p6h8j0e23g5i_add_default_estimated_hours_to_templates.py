"""add default_estimated_labor_hours to service_templates

Revision ID: p6h8j0e23g5i
Revises: o5g7i9d12f4h
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'p6h8j0e23g5i'
down_revision = 'o5g7i9d12f4h'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('service_templates', sa.Column('default_estimated_labor_hours', sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('service_templates', 'default_estimated_labor_hours')
