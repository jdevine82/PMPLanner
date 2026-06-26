"""add projects table

Revision ID: q7i9k1f23h5j
Revises: p6h8j0e23g5i
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'q7i9k1f23h5j'
down_revision = 'p6h8j0e23g5i'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('month_hours', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('projects')
