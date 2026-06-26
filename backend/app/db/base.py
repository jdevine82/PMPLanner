from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic autogenerate can detect them
from app.models import (  # noqa: E402, F401
    app_setting,
    asset,
    customer,
    database_backup_log,
    job_comment,
    job_instance,
    maintenance_schedule,
    service_template,
    site,
    site_location,
    user,
)
