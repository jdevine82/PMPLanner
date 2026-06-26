import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, require_admin
from app.models.database_backup_log import DatabaseBackupLog

router = APIRouter()

BACKUP_DIR = Path(settings.UPLOADS_DIR) / "backups"


def _parse_db_url(url: str) -> dict:
    p = urlparse(url)
    return {
        "host":     p.hostname or "localhost",
        "port":     str(p.port or 5432),
        "user":     p.username or "",
        "password": p.password or "",
        "dbname":   p.path.lstrip("/"),
    }


@router.post("/create", dependencies=[Depends(require_admin)])
def create_backup(db: Session = Depends(get_db)):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"pmplanner_backup_{timestamp}.dump"
    filepath  = BACKUP_DIR / filename

    conn = _parse_db_url(settings.DATABASE_URL)

    result = subprocess.run(
        ["pg_dump", "-h", conn["host"], "-p", conn["port"], "-U", conn["user"], "-d", conn["dbname"], "-Fc", "-f", str(filepath)],
        env={**os.environ, "PGPASSWORD": conn["password"]},
        capture_output=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise HTTPException(500, f"pg_dump failed: {result.stderr.decode()}")

    file_size = filepath.stat().st_size
    log = DatabaseBackupLog(filename=filename, file_size_bytes=file_size)
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "filename":        filename,
        "file_size_bytes": file_size,
        "created_at":      log.created_at.isoformat(),
    }


@router.post("/upload", dependencies=[Depends(require_admin)])
async def upload_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = Path(file.filename or "").name
    if not filename.endswith(".dump") or "/" in filename or "\\" in filename:
        raise HTTPException(400, "File must be a .dump file")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    filepath = BACKUP_DIR / filename

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = filepath.stat().st_size
    log = DatabaseBackupLog(filename=filename, file_size_bytes=file_size)
    db.add(log)
    db.commit()

    return {"filename": filename, "file_size_bytes": file_size}


@router.get("/download/{filename}", dependencies=[Depends(require_admin)])
def download_backup(filename: str):
    if "/" in filename or "\\" in filename or not filename.endswith(".dump"):
        raise HTTPException(400, "Invalid filename")
    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "Backup file not found")
    return FileResponse(filepath, filename=filename, media_type="application/octet-stream")


@router.get("/logs", dependencies=[Depends(require_admin)])
def list_backup_logs(db: Session = Depends(get_db)):
    return db.query(DatabaseBackupLog).order_by(DatabaseBackupLog.created_at.desc()).limit(50).all()


@router.post("/restore", dependencies=[Depends(require_admin)])
def restore_backup(filename: str, confirmation: str, db: Session = Depends(get_db)):
    if confirmation != "RESTORE":
        raise HTTPException(400, "Type RESTORE to confirm")

    filepath = BACKUP_DIR / filename
    if not filepath.exists() or not filepath.name.endswith(".dump"):
        raise HTTPException(404, "Backup file not found")

    conn = _parse_db_url(settings.DATABASE_URL)

    result = subprocess.run(
        ["pg_restore", "-h", conn["host"], "-p", conn["port"], "-U", conn["user"], "-d", conn["dbname"], "--clean", "--if-exists", str(filepath)],
        env={**os.environ, "PGPASSWORD": conn["password"]},
        capture_output=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise HTTPException(500, f"pg_restore failed: {result.stderr.decode()}")

    return {"message": f"Database restored from {filename}"}
