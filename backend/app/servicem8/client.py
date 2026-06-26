import asyncio

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


async def fetch_all_companies(db: Session) -> list[dict]:
    """Fetch all active companies enriched with primary contact details."""
    async with make_client(db) as client:
        companies_r, contacts_r = await asyncio.gather(
            client.get("/company.json"),
            client.get("/companycontact.json"),
        )
    companies_r.raise_for_status()
    contacts_r.raise_for_status()

    # Build a lookup: company_uuid → best contact
    # Priority: JOB+primary > JOB > any active
    job_primary: dict[str, dict] = {}
    job_any: dict[str, dict] = {}
    any_contact: dict[str, dict] = {}
    for ct in contacts_r.json():
        if ct.get("active") != 1:
            continue
        cid = ct.get("company_uuid") or ""
        if not cid:
            continue
        is_job = ct.get("type") == "JOB"
        is_primary = ct.get("is_primary_contact") == "1"
        if is_job and is_primary:
            job_primary.setdefault(cid, ct)
        elif is_job:
            job_any.setdefault(cid, ct)
        else:
            any_contact.setdefault(cid, ct)

    enriched = []
    for c in companies_r.json():
        if c.get("active") != 1:
            continue
        uuid = c.get("uuid") or ""
        ct = job_primary.get(uuid) or job_any.get(uuid) or any_contact.get(uuid)
        if ct:
            first = (ct.get("first") or "").strip()
            last = (ct.get("last") or "").strip()
            c["_contact_name"] = f"{first} {last}".strip() or None
            c["_contact_phone"] = ct.get("mobile") or ct.get("phone") or None
            c["_contact_email"] = ct.get("email") or None
        else:
            c["_contact_name"] = None
            c["_contact_phone"] = None
            c["_contact_email"] = None
        enriched.append(c)

    return enriched


async def search_companies(db: Session, term: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/company.json", params={"$filter": f"name like '%{term}%'"})
        r.raise_for_status()
        return [c for c in r.json() if c.get("active") == 1]


async def fetch_company(db: Session, company_uuid: str) -> dict | None:
    async with make_client(db) as client:
        r = await client.get(f"/company/{company_uuid}.json")
        r.raise_for_status()
        return r.json()


async def fetch_assets_for_company(db: Session, company_uuid: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/asset.json", params={"$filter": f"company_uuid eq '{company_uuid}'"})
        r.raise_for_status()
        return [a for a in r.json() if a.get("active") == 1]


async def create_job(db: Session, payload: dict) -> tuple[str, int | None]:
    """POST a job to ServiceM8. Returns (uuid, job_number) where job_number is the generated_job_id."""
    async with make_client(db) as client:
        r = await client.post("/job.json", json=payload)
        r.raise_for_status()
        uuid = r.headers.get("x-record-uuid", "")
        job_number = None
        if uuid:
            job_r = await client.get(f"/job/{uuid}.json")
            if job_r.is_success:
                val = job_r.json().get("generated_job_id")
                if val is not None:
                    job_number = int(val)
        return uuid, job_number


async def fetch_job(db: Session, sm8_job_uuid: str) -> dict | None:
    async with make_client(db) as client:
        r = await client.get(f"/job/{sm8_job_uuid}.json")
        if not r.is_success:
            return None
        return r.json()


async def fetch_job_activities(db: Session, sm8_job_uuid: str) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/jobactivity.json", params={"$filter": f"job_uuid eq '{sm8_job_uuid}'"})
        r.raise_for_status()
        return r.json()


async def fetch_badges(db: Session) -> list[dict]:
    async with make_client(db) as client:
        r = await client.get("/badge.json")
        r.raise_for_status()
        return [b for b in r.json() if b.get("active") == 1]
