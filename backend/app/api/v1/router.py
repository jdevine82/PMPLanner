from fastapi import APIRouter

from app.api.v1.endpoints import (
    app_settings,
    assets,
    auth,
    backup,
    customers,
    job_comments,
    job_instances,
    maintenance_schedules,
    reports,
    service_templates,
    servicem8,
    site_locations,
    sites,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router,                 prefix="/auth",            tags=["Auth"])
api_router.include_router(users.router,                prefix="/users",           tags=["Users"])
api_router.include_router(customers.router,            prefix="/customers",       tags=["Customers"])
api_router.include_router(sites.router,                prefix="/sites",           tags=["Sites"])
api_router.include_router(site_locations.router,       prefix="/site-locations",  tags=["Site Locations"])
api_router.include_router(assets.router,               prefix="/assets",          tags=["Assets"])
api_router.include_router(service_templates.router,    prefix="/service-templates", tags=["Service Templates"])
api_router.include_router(maintenance_schedules.router,prefix="/schedules",       tags=["Maintenance Schedules"])
api_router.include_router(job_instances.router,        prefix="/jobs",            tags=["Job Instances"])
api_router.include_router(job_comments.router,         prefix="/jobs",            tags=["Job Comments"])
api_router.include_router(app_settings.router,         prefix="/settings",        tags=["Settings"])
api_router.include_router(servicem8.router,            prefix="/servicem8",       tags=["ServiceM8"])
api_router.include_router(reports.router,              prefix="/reports",         tags=["Reports"])
api_router.include_router(backup.router,               prefix="/backup",          tags=["Backup"])
