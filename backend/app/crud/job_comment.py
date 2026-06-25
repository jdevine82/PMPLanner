from sqlalchemy.orm import Session

from app.models.job_comment import JobComment
from app.schemas.job_comment import JobCommentCreate


def get_by_job(db: Session, job_instance_id: int) -> list[JobComment]:
    return (
        db.query(JobComment)
        .filter(JobComment.job_instance_id == job_instance_id)
        .order_by(JobComment.created_at)
        .all()
    )


def create(db: Session, job_instance_id: int, user_id: int, data: JobCommentCreate) -> JobComment:
    obj = JobComment(job_instance_id=job_instance_id, user_id=user_id, comment_text=data.comment_text)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, comment: JobComment) -> None:
    db.delete(comment)
    db.commit()
