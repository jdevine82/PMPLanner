import os
import shutil

from sqlalchemy.orm import Session

from app.models.service_template import ServiceTemplate
from app.schemas.service_template import ServiceTemplateUpdate


def get(db: Session, template_id: int) -> ServiceTemplate | None:
    return db.get(ServiceTemplate, template_id)


def get_all(db: Session) -> list[ServiceTemplate]:
    return db.query(ServiceTemplate).order_by(ServiceTemplate.title).all()


def create(
    db: Session,
    title: str,
    parsed_text: str,
    filename: str | None,
    interval_months: int | None = None,
    default_estimated_labor_hours: float | None = None,
    job_description: str | None = None,
    work_completed: str | None = None,
    attachments: list | None = None,
    job_badges: list | None = None,
) -> ServiceTemplate:
    obj = ServiceTemplate(
        title=title,
        parsed_document_text=parsed_text,
        original_filename=filename,
        interval_months=interval_months,
        default_estimated_labor_hours=default_estimated_labor_hours,
        job_description=job_description,
        work_completed=work_completed,
        attachments=attachments,
        job_badges=job_badges,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, template: ServiceTemplate, data: ServiceTemplateUpdate) -> ServiceTemplate:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


def replace_document(db: Session, template: ServiceTemplate, parsed_text: str, filename: str) -> ServiceTemplate:
    template.parsed_document_text = parsed_text
    template.original_filename = filename
    db.commit()
    db.refresh(template)
    return template


def recalculate_average_hours(db: Session, template: ServiceTemplate) -> None:
    from app.models.job_instance import JobInstance
    from app.models.maintenance_schedule import MaintenanceSchedule

    result = (
        db.query(JobInstance.actual_labor_hours)
        .join(MaintenanceSchedule, JobInstance.schedule_id == MaintenanceSchedule.id)
        .filter(
            MaintenanceSchedule.service_id == template.id,
            JobInstance.sync_status == "Completed",
            JobInstance.actual_labor_hours.isnot(None),
        )
        .all()
    )
    if result:
        avg = sum(r[0] for r in result) / len(result)
        template.historical_average_labor_hours = round(avg, 2)
        db.commit()


def delete(db: Session, template: ServiceTemplate, uploads_dir: str) -> None:
    if template.original_filename:
        path = os.path.join(uploads_dir, "templates", template.original_filename)
        if os.path.exists(path):
            os.remove(path)
    db.delete(template)
    db.commit()
