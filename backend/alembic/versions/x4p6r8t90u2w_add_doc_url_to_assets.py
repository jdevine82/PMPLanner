"""add doc_url to assets

Revision ID: x4p6r8t90u2w
Revises: w3o5q7s89t1v
Create Date: 2026-06-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'x4p6r8t90u2w'
down_revision = 'w3o5q7s89t1v'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assets', sa.Column('doc_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('assets', 'doc_url')
