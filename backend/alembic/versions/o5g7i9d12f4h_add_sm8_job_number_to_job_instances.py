"""add sm8 job number to job instances

Revision ID: o5g7i9d12f4h
Revises: n4f6h8c01e3g
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'o5g7i9d12f4h'
down_revision = 'n4f6h8c01e3g'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('job_instances', sa.Column('servicem8_job_number', sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column('job_instances', 'servicem8_job_number')
