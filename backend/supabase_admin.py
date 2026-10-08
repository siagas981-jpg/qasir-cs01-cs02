import os
import httpx

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ADMIN_HEADERS = {"apikey": SERVICE_KEY, "Content-Type": "application/json"}


def client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=SUPABASE_URL, headers=ADMIN_HEADERS, timeout=15)
