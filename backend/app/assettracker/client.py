"""
HTTP client for the AssetTracker API.
Authenticates via email/password and caches the JWT token in memory.
"""
import logging
import time

import httpx
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting

logger = logging.getLogger(__name__)

# In-memory token cache: base_url → (access_token, expiry_unix)
_token_cache: dict[str, tuple[str, float]] = {}
_TOKEN_TTL = 25 * 60  # 25 minutes (AT tokens expire at 30 min by default)


def _get_settings(db: Session) -> AppSetting:
    setting = db.query(AppSetting).first()
    if not setting or not setting.assettracker_enabled:
        raise ValueError("AssetTracker integration is not enabled. Visit Settings to configure it.")
    if not setting.assettracker_base_url:
        raise ValueError("AssetTracker base URL is not configured.")
    if not setting.assettracker_email or not setting.assettracker_password:
        raise ValueError("AssetTracker credentials are not configured.")
    return setting


async def _get_token(base_url: str, email: str, password: str) -> str:
    """Return a valid JWT token, refreshing if expired."""
    cached = _token_cache.get(base_url)
    if cached and time.time() < cached[1]:
        return cached[0]

    async with httpx.AsyncClient(base_url=base_url, timeout=15.0) as client:
        r = await client.post("/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        token = r.json()["access_token"]

    _token_cache[base_url] = (token, time.time() + _TOKEN_TTL)
    return token


def _invalidate_token(base_url: str) -> None:
    _token_cache.pop(base_url, None)


async def make_client(db: Session) -> tuple[httpx.AsyncClient, str]:
    """Return an authenticated AsyncClient and the base_url. Caller must use as async context manager."""
    setting = _get_settings(db)
    base_url = setting.assettracker_base_url.rstrip("/")
    token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)
    client = httpx.AsyncClient(
        base_url=base_url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=30.0,
    )
    return client, base_url


async def create_work_order(db: Session, payload: dict) -> dict:
    """POST /work-orders and return the created work order dict."""
    setting = _get_settings(db)
    base_url = setting.assettracker_base_url.rstrip("/")
    token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        r = await client.post("/work-orders", json=payload, headers=headers)
        if r.status_code == 401:
            _invalidate_token(base_url)
            token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)
            headers["Authorization"] = f"Bearer {token}"
            r = await client.post("/work-orders", json=payload, headers=headers)
        r.raise_for_status()
        return r.json()


async def get_work_order(db: Session, wo_id: int) -> dict | None:
    """GET /work-orders/{wo_id} and return the work order dict, or None if not found."""
    setting = _get_settings(db)
    base_url = setting.assettracker_base_url.rstrip("/")
    token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        r = await client.get(f"/work-orders/{wo_id}", headers=headers)
        if r.status_code == 401:
            _invalidate_token(base_url)
            token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)
            headers["Authorization"] = f"Bearer {token}"
            r = await client.get(f"/work-orders/{wo_id}", headers=headers)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()


async def test_connection(db: Session) -> dict:
    """Verify credentials by logging in and fetching /auth/me. Returns user info."""
    setting = _get_settings(db)
    base_url = setting.assettracker_base_url.rstrip("/")
    _invalidate_token(base_url)
    token = await _get_token(base_url, setting.assettracker_email, setting.assettracker_password)

    async with httpx.AsyncClient(base_url=base_url, timeout=15.0) as client:
        r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        r.raise_for_status()
        return r.json()
