"""drop job_description from service_templates

Revision ID: s9k1m3h45j7l
Revises: r8j0l2g34i6k
Create Date: 2026-06-28

"""
from alembic import op
import sqlalchemy as sa

revision = 's9k1m3h45j7l'
down_revision = 'r8j0l2g34i6k'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('service_templates', 'job_description')


def downgrade() -> None:
    op.add_column('service_templates', sa.Column('job_description', sa.Text, nullable=True))
