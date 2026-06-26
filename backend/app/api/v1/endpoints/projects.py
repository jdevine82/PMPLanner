from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_staff, require_admin
from app.crud import project as crud
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter()


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud.get_all(db)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db), _=Depends(require_staff)):
    return crud.create(db, data)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    obj = crud.get(db, project_id)
    if not obj:
        raise HTTPException(404, "Project not found")
    return obj


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db), _=Depends(require_staff)):
    obj = crud.get(db, project_id)
    if not obj:
        raise HTTPException(404, "Project not found")
    return crud.update(db, obj, data)


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db)):
    obj = crud.get(db, project_id)
    if not obj:
        raise HTTPException(404, "Project not found")
    crud.delete(db, obj)
