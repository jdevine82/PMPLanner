from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import service_template as crud
from app.schemas.service_template import ServiceTemplateOut, ServiceTemplateUpdate, ServiceTemplateManualCreate

router = APIRouter()


@router.get("", response_model=list[ServiceTemplateOut])
def list_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud.get_all(db)


@router.post("/manual", response_model=ServiceTemplateOut, status_code=201)
def create_template_manual(
    data: ServiceTemplateManualCreate,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return crud.create(
        db, data.title, data.content, None,
        interval_months=data.interval_months,
        default_estimated_labor_hours=data.default_estimated_labor_hours,
        work_completed=data.work_completed,
        attachments=data.attachments,
        job_badges=data.job_badges,
    )


@router.get("/{template_id}", response_model=ServiceTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, template_id)
    if not obj:
        raise HTTPException(404, "Template not found")
    return obj


@router.patch("/{template_id}", response_model=ServiceTemplateOut)
def update_template(
    template_id: int, data: ServiceTemplateUpdate, db: Session = Depends(get_db), _=Depends(require_staff)
):
    obj = crud.get(db, template_id)
    if not obj:
        raise HTTPException(404, "Template not found")
    return crud.update(db, obj, data)


@router.delete("/{template_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_template(template_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, template_id)
    if not obj:
        raise HTTPException(404, "Template not found")
    crud.delete(db, obj, settings.UPLOADS_DIR)
