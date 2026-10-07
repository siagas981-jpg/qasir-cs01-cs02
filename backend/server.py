import os
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header  # noqa: E402
from pydantic import BaseModel, EmailStr, Field  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from supabase_admin import client  # noqa: E402

logger = logging.getLogger("qasir")
logging.basicConfig(level=logging.INFO)

app = FastAPI()
api = APIRouter(prefix="/api")


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing access token")
    token = authorization.split(" ", 1)[1]
    async with client() as c:
        r = await c.get("/auth/v1/user", headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            raise HTTPException(401, "Invalid or expired access token")
        user = r.json()
        p = await c.get("/rest/v1/profiles", params={"id": f"eq.{user['id']}", "select": "role,outlet_id"})
    rows = p.json() if p.status_code == 200 else []
    user["profile"] = rows[0] if rows else None
    return user


async def require_owner(user: dict = Depends(current_user)) -> dict:
    if not user["profile"] or user["profile"]["role"] != "owner":
        raise HTTPException(403, "Owner role required")
    return user


class NewCashier(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None
    outlet_id: str


@api.get("/")
async def root():
    return {"message": "CS Qasir API"}


@api.get("/health")
async def health():
    async with client() as c:
        r = await c.get("/rest/v1/outlets", params={"select": "id", "limit": "1"})
    ok = r.status_code == 200
    return {"supabase": "ok" if ok else "error", "status_code": r.status_code}


@api.post("/staff", status_code=201)
async def create_cashier(body: NewCashier, _owner: dict = Depends(require_owner)):
    async with client() as c:
        o = await c.get("/rest/v1/outlets", params={"id": f"eq.{body.outlet_id}", "select": "id"})
        if o.status_code != 200 or not o.json():
            raise HTTPException(400, "Outlet not found")
        r = await c.post("/auth/v1/admin/users", json={
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name} if body.full_name else {},
        })
        if r.status_code not in (200, 201):
            msg = r.json().get("msg") or r.json().get("message") or "Could not create user"
            raise HTTPException(400, msg)
        uid = r.json()["id"]
        u = await c.patch(
            "/rest/v1/profiles",
            params={"id": f"eq.{uid}"},
            json={"role": "cashier", "outlet_id": body.outlet_id, "full_name": body.full_name},
            headers={"Prefer": "return=representation"},
        )
    if u.status_code != 200 or not u.json():
        raise HTTPException(500, "User created but profile assignment failed")
    return u.json()[0]


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
