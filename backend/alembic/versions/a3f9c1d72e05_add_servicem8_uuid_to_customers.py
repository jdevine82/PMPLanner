"""add servicem8_uuid to customers

Revision ID: a3f9c1d72e05
Revises: 6a3aa5038914
Create Date: 2026-06-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f9c1d72e05'
down_revision: Union[str, None] = '6a3aa5038914'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('servicem8_uuid', sa.String(255), nullable=True))
    op.create_unique_constraint('uq_customers_servicem8_uuid', 'customers', ['servicem8_uuid'])


def downgrade() -> None:
    op.drop_constraint('uq_customers_servicem8_uuid', 'customers', type_='unique')
    op.drop_column('customers', 'servicem8_uuid')
