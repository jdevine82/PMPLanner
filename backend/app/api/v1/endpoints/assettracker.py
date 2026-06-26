from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.assettracker import client as at_client
from app.assettracker import sync as at_sync
from app.core.deps import get_current_user, get_db, require_staff

router = APIRouter()


@router.get("/test-connection")
async def test_connection(db: Session = Depends(get_db), _=Depends(require_staff)):
    """Verify AssetTracker credentials by logging in and returning the service account info."""
    try:
        info = await at_client.test_connection(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"AssetTracker connection failed: {e}")
    return {"status": "ok", "user": info}


@router.post("/dispatch")
async def dispatch_jobs(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(require_staff)):
    """Kick off background dispatch of Approved+Unsynced jobs to AssetTracker."""
    background_tasks.add_task(at_sync.dispatch_approved_jobs, db)
    return {"message": "Dispatch started in background. Refresh job statuses shortly."}


@router.post("/dispatch/sync")
async def dispatch_jobs_sync(db: Session = Depends(get_db), _=Depends(require_staff)):
    """Synchronous dispatch — waits for completion and returns a summary."""
    try:
        result = await at_sync.dispatch_approved_jobs(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"AssetTracker dispatch error: {e}")
    return result


@router.post("/pull-completed")
async def pull_completed(background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(require_staff)):
    """Background pull of completed AssetTracker work orders to update PMPlanner job status."""
    background_tasks.add_task(at_sync.pull_completed_from_assettracker, db)
    return {"message": "Pull started in background. Refresh job statuses shortly."}


@router.post("/pull-completed/sync")
async def pull_completed_sync(db: Session = Depends(get_db), _=Depends(require_staff)):
    """Synchronous pull — waits for completion and returns a summary."""
    try:
        result = await at_sync.pull_completed_from_assettracker(db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"AssetTracker pull error: {e}")
    return result
