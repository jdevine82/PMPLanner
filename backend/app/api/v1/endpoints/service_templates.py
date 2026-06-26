import os
import uuid

from docx import Document
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_admin, require_staff
from app.crud import service_template as crud
from app.schemas.service_template import ServiceTemplateOut, ServiceTemplateUpdate, ServiceTemplateManualCreate

router = APIRouter()


def _parse_docx(file_bytes: bytes) -> str:
    import io
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _save_file(file_bytes: bytes, original_name: str) -> str:
    ext = os.path.splitext(original_name)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(settings.UPLOADS_DIR, "templates")
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(dest_dir, filename), "wb") as f:
        f.write(file_bytes)
    return filename


@router.get("", response_model=list[ServiceTemplateOut])
def list_templates(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud.get_all(db)


@router.post("", response_model=ServiceTemplateOut, status_code=201)
def create_template(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    if not file.filename.endswith(".docx"):
        raise HTTPException(400, "Only .docx files are accepted")
    file_bytes = file.file.read()
    parsed_text = _parse_docx(file_bytes)
    filename = _save_file(file_bytes, file.filename)
    return crud.create(db, title, parsed_text, filename)


@router.post("/manual", response_model=ServiceTemplateOut, status_code=201)
def create_template_manual(
    data: ServiceTemplateManualCreate,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return crud.create(
        db, data.title, data.content, None,
        interval_months=data.interval_months,
        job_description=data.job_description,
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


@router.put("/{template_id}/document", response_model=ServiceTemplateOut)
def replace_document(
    template_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    obj = crud.get(db, template_id)
    if not obj:
        raise HTTPException(404, "Template not found")
    if not file.filename.endswith(".docx"):
        raise HTTPException(400, "Only .docx files are accepted")
    file_bytes = file.file.read()
    parsed_text = _parse_docx(file_bytes)
    filename = _save_file(file_bytes, file.filename)
    return crud.replace_document(db, obj, parsed_text, filename)


@router.delete("/{template_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_template(template_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, template_id)
    if not obj:
        raise HTTPException(404, "Template not found")
    crud.delete(db, obj, settings.UPLOADS_DIR)
