import httpx
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting

SM8_BASE = "https://api.servicem8.com/api_1.0"


def _get_api_key(db: Session) -> str:
    setting = db.query(AppSetting).first()
    if not setting or not setting.servicem8_api_key:
        raise ValueError("ServiceM8 API key is not configured. Visit Settings to add it.")
    return setting.servicem8_api_key


def make_client(db: Session) -> httpx.AsyncClient:
    api_key = _get_api_key(db)
    return httpx.AsyncClient(
        base_url=SM8_BASE,
        headers={"X-API-Key": api_key, "Accept": "application/json"},
        timeout=30.0,
    )


async def search_companies(db: Session, term: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/company.json", params={"$filter": f"name like '%{term}%'"})
        r.raise_for_status()
        return [c for c in r.json() if c.get("active") == 1]


async def fetch_assets_for_company(db: Session, company_uuid: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/asset.json", params={"$filter": f"company_uuid eq '{company_uuid}'"})
        r.raise_for_status()
        return [a for a in r.json() if a.get("active") == 1]


async def create_job(db: Session, payload: dict) -> str:
    """POST a job to ServiceM8. Returns the new job UUID extracted from the Location header."""
    async with make_client(db) as client:
        r = await client.post("/job.json", json=payload)
        r.raise_for_status()
        location = r.headers.get("Location", "")
        return location.rstrip("/").split("/")[-1].replace(".json", "")


async def fetch_job_activities(db: Session, sm8_job_uuid: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/jobactivity.json", params={"$filter": f"job_uuid eq '{sm8_job_uuid}'"})
        r.raise_for_status()
        return r.json()
