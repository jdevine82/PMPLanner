"""add AssetTracker integration fields

Revision ID: r8j0l2g34i6k
Revises: q7i9k1f23h5j
Branch_labels = None
depends_on = None
"""
from alembic import op
import sqlalchemy as sa

revision = 'r8j0l2g34i6k'
down_revision = 'q7i9k1f23h5j'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_settings', sa.Column('assettracker_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('app_settings', sa.Column('assettracker_base_url', sa.String(500), nullable=True))
    op.add_column('app_settings', sa.Column('assettracker_email', sa.String(255), nullable=True))
    op.add_column('app_settings', sa.Column('assettracker_password', sa.String(255), nullable=True))
    op.add_column('app_settings', sa.Column('assettracker_default_asset_id', sa.Integer(), nullable=True))
    op.add_column('job_instances', sa.Column('assettracker_wo_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('job_instances', 'assettracker_wo_id')
    op.drop_column('app_settings', 'assettracker_default_asset_id')
    op.drop_column('app_settings', 'assettracker_password')
    op.drop_column('app_settings', 'assettracker_email')
    op.drop_column('app_settings', 'assettracker_base_url')
    op.drop_column('app_settings', 'assettracker_enabled')
