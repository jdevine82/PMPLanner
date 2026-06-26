import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_admin
from app.models.app_setting import AppSetting
from app.schemas.app_setting import AppSettingCreate, AppSettingOut, AppSettingUpdate

router = APIRouter()


def _get_singleton(db: Session) -> AppSetting | None:
    return db.query(AppSetting).first()


@router.get("", response_model=AppSettingOut, dependencies=[Depends(get_current_user)])
def get_settings(db: Session = Depends(get_db)):
    obj = _get_singleton(db)
    if not obj:
        raise HTTPException(404, "Settings not configured yet")
    return obj


@router.post("", response_model=AppSettingOut, status_code=201, dependencies=[Depends(require_admin)])
def create_settings(data: AppSettingCreate, db: Session = Depends(get_db)):
    if _get_singleton(db):
        raise HTTPException(400, "Settings already exist — use PATCH to update")
    obj = AppSetting(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("", response_model=AppSettingOut, dependencies=[Depends(require_admin)])
def update_settings(data: AppSettingUpdate, db: Session = Depends(get_db)):
    obj = _get_singleton(db)
    if not obj:
        raise HTTPException(404, "Settings not configured yet")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/logo", response_model=AppSettingOut, dependencies=[Depends(require_admin)])
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    obj = _get_singleton(db)
    if not obj:
        raise HTTPException(404, "Settings not configured yet")

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are accepted")

    ext = os.path.splitext(file.filename or "logo.png")[1] or ".png"
    filename = f"logo_{uuid.uuid4().hex}{ext}"
    logo_dir = os.path.join(settings.UPLOADS_DIR, "logo")
    os.makedirs(logo_dir, exist_ok=True)

    # Remove old logo if present
    if obj.logo_filename:
        old_path = os.path.join(logo_dir, obj.logo_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    with open(os.path.join(logo_dir, filename), "wb") as f:
        f.write(file.file.read())

    obj.logo_filename = filename
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/logo", response_model=AppSettingOut, dependencies=[Depends(require_admin)])
def delete_logo(db: Session = Depends(get_db)):
    obj = _get_singleton(db)
    if not obj:
        raise HTTPException(404, "Settings not configured yet")
    if obj.logo_filename:
        path = os.path.join(settings.UPLOADS_DIR, "logo", obj.logo_filename)
        if os.path.exists(path):
            os.remove(path)
        obj.logo_filename = None
        db.commit()
        db.refresh(obj)
    return obj
