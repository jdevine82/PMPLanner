from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.models.app_setting import AppSetting
from app.schemas.app_setting import AppSettingCreate, AppSettingOut, AppSettingUpdate

router = APIRouter()


def _get_singleton(db: Session) -> AppSetting | None:
    return db.query(AppSetting).first()


@router.get("", response_model=AppSettingOut, dependencies=[Depends(require_admin)])
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
