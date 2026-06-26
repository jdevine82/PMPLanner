from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def get_all(db: Session) -> list[Project]:
    return db.query(Project).order_by(Project.name).all()


def get(db: Session, project_id: int) -> Project | None:
    return db.get(Project, project_id)


def create(db: Session, data: ProjectCreate) -> Project:
    obj = Project(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update(db: Session, project: Project, data: ProjectUpdate) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()
