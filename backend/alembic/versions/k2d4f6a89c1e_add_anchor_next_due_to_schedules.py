"""add date_anchor_next_due to maintenance_schedules

Revision ID: k2d4f6a89c1e
Revises: h8c9e0f12a4b
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'k2d4f6a89c1e'
down_revision = 'h8c9e0f12a4b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('maintenance_schedules', sa.Column('date_anchor_next_due', sa.Date, nullable=True))


def downgrade() -> None:
    op.drop_column('maintenance_schedules', 'date_anchor_next_due')
