import os
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
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


async def _target_role(c, uid: str) -> Optional[str]:
    p = await c.get("/rest/v1/profiles", params={"id": f"eq.{uid}", "select": "role"})
    rows = p.json() if p.status_code == 200 else []
    return rows[0]["role"] if rows else None


class NewEmployee(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    full_name: Optional[str] = None
    role: str = "cashier"
    outlet_id: str


class NewPassword(BaseModel):
    password: str = Field(min_length=6)


class SupplierIn(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = None
    address: Optional[str] = None


class PurchaseItemIn(BaseModel):
    product_id: str
    qty: int = Field(gt=0)
    buy_price: int = Field(ge=0)


class PurchaseIn(BaseModel):
    supplier_id: Optional[str] = None
    outlet_id: str
    invoice_no: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None
    items: list[PurchaseItemIn] = Field(min_length=1)


@api.get("/")
async def root():
    return {"message": "CS Qasir API"}


@api.get("/health")
async def health():
    async with client() as c:
        r = await c.get("/rest/v1/outlets", params={"select": "id", "limit": "1"})
    ok = r.status_code == 200
    return {"supabase": "ok" if ok else "error", "status_code": r.status_code}


@api.post("/employees", status_code=201)
async def create_employee(body: NewEmployee, _owner: dict = Depends(require_owner)):
    if body.role not in ("cashier", "manager"):
        raise HTTPException(400, "Role harus cashier atau manager")
    if "@" not in body.email or "." not in body.email.split("@")[-1]:
        raise HTTPException(400, "Email tidak valid")
    email = body.email.strip().lower()
    async with client() as c:
        o = await c.get("/rest/v1/outlets", params={"id": f"eq.{body.outlet_id}", "select": "id"})
        if o.status_code != 200 or not o.json():
            raise HTTPException(400, "Outlet not found")
        r = await c.post("/auth/v1/admin/users", json={
            "email": email,
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
            json={"role": body.role, "outlet_id": body.outlet_id, "full_name": body.full_name, "is_active": True},
            headers={"Prefer": "return=representation"},
        )
        if u.status_code != 200 or not u.json():
            await c.delete(f"/auth/v1/admin/users/{uid}")
            raise HTTPException(500, "Profile assignment failed; user creation rolled back")
    return u.json()[0]


@api.post("/employees/{uid}/password")
async def reset_employee_password(uid: str, body: NewPassword, owner: dict = Depends(require_owner)):
    if uid == owner["id"]:
        raise HTTPException(400, "Gunakan halaman reset password untuk akun sendiri")
    async with client() as c:
        if await _target_role(c, uid) in ("owner", "admin"):
            raise HTTPException(400, "Tidak bisa mengubah akun owner/admin")
        r = await c.put(f"/auth/v1/admin/users/{uid}", json={"password": body.password})
        if r.status_code != 200:
            logger.warning("admin updateUserById failed: %s %s", r.status_code, r.text)
            raise HTTPException(400, "Gagal mengatur ulang password")
    return {"ok": True}


@api.delete("/employees/{uid}")
async def delete_employee(uid: str, owner: dict = Depends(require_owner)):
    if uid == owner["id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    async with client() as c:
        if await _target_role(c, uid) in ("owner", "admin"):
            raise HTTPException(400, "Tidak bisa menghapus akun owner/admin")
        r = await c.delete(f"/auth/v1/admin/users/{uid}")
        if r.status_code not in (200, 204):
            logger.warning("admin deleteUser failed: %s %s", r.status_code, r.text)
            raise HTTPException(400, "Gagal menghapus user")
    return {"ok": True}


# ───────────── Suppliers ─────────────
@api.get("/suppliers")
async def list_suppliers(_owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.get("/rest/v1/suppliers", params={"select": "*", "order": "name"})
    return r.json()


@api.post("/suppliers", status_code=201)
async def create_supplier(body: SupplierIn, _owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.post("/rest/v1/suppliers", json=body.model_dump(), headers={"Prefer": "return=representation"})
    if r.status_code not in (200, 201):
        raise HTTPException(400, "Gagal menyimpan supplier")
    return r.json()[0]


@api.put("/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, _owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.patch("/rest/v1/suppliers", params={"id": f"eq.{sid}"},
                          json=body.model_dump(), headers={"Prefer": "return=representation"})
    if r.status_code != 200 or not r.json():
        raise HTTPException(400, "Gagal memperbarui supplier")
    return r.json()[0]


@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, _owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.delete("/rest/v1/suppliers", params={"id": f"eq.{sid}"})
    if r.status_code not in (200, 204):
        raise HTTPException(400, "Gagal menghapus supplier")
    return {"ok": True}


# ───────────── Purchases ─────────────
@api.get("/purchases")
async def list_purchases(outlet_id: Optional[str] = None, _owner: dict = Depends(require_owner)):
    params = {"select": "*,suppliers(name)", "order": "created_at.desc"}
    if outlet_id:
        params["outlet_id"] = f"eq.{outlet_id}"
    async with client() as c:
        r = await c.get("/rest/v1/purchases", params=params)
    return r.json()


@api.get("/purchases/{pid}")
async def get_purchase(pid: str, _owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.get("/rest/v1/purchases", params={
            "id": f"eq.{pid}",
            "select": "*,suppliers(name,phone,address),purchase_items(*,products(name,sku))",
        })
    rows = r.json()
    if not rows:
        raise HTTPException(404, "Pembelian tidak ditemukan")
    return rows[0]


@api.post("/purchases", status_code=201)
async def create_purchase(body: PurchaseIn, owner: dict = Depends(require_owner)):
    total = sum(i.qty * i.buy_price for i in body.items)
    async with client() as c:
        o = await c.get("/rest/v1/outlets", params={"id": f"eq.{body.outlet_id}", "select": "id"})
        if o.status_code != 200 or not o.json():
            raise HTTPException(400, "Outlet tidak ditemukan")
        pr = await c.post("/rest/v1/purchases", json={
            "supplier_id": body.supplier_id, "outlet_id": body.outlet_id,
            "invoice_no": body.invoice_no, "date": body.date, "notes": body.notes,
            "total_cost": total, "status": "Draft", "created_by": owner["id"],
        }, headers={"Prefer": "return=representation"})
        if pr.status_code not in (200, 201):
            raise HTTPException(400, "Gagal membuat pembelian")
        pid = pr.json()[0]["id"]
        items = [{
            "purchase_id": pid, "product_id": i.product_id, "qty": i.qty,
            "buy_price": i.buy_price, "subtotal": i.qty * i.buy_price,
        } for i in body.items]
        ir = await c.post("/rest/v1/purchase_items", json=items)
        if ir.status_code not in (200, 201):
            await c.delete("/rest/v1/purchases", params={"id": f"eq.{pid}"})
            raise HTTPException(400, "Gagal menyimpan item pembelian")
    return pr.json()[0]


@api.post("/purchases/{pid}/receive")
async def do_receive_purchase(pid: str, owner: dict = Depends(require_owner)):
    async with client() as c:
        r = await c.post("/rest/v1/rpc/receive_purchase", json={"p_purchase_id": pid, "p_actor": owner["id"]})
    if r.status_code not in (200, 204):
        detail = "Gagal menerima pembelian"
        try:
            j = r.json()
            if "ALREADY_RECEIVED" in str(j):
                detail = "Pembelian sudah diterima"
            elif "PURCHASE_NOT_FOUND" in str(j):
                detail = "Pembelian tidak ditemukan"
            else:
                detail = j.get("message") or detail
        except Exception:
            pass
        raise HTTPException(400, detail)
    return r.json() if r.text else {"ok": True}


@api.delete("/purchases/{pid}")
async def delete_purchase(pid: str, _owner: dict = Depends(require_owner)):
    async with client() as c:
        chk = await c.get("/rest/v1/purchases", params={"id": f"eq.{pid}", "select": "status"})
        rows = chk.json()
        if not rows:
            raise HTTPException(404, "Pembelian tidak ditemukan")
        if rows[0]["status"] == "Diterima":
            raise HTTPException(400, "Pembelian sudah diterima, tidak bisa dihapus")
        r = await c.delete("/rest/v1/purchases", params={"id": f"eq.{pid}"})
    if r.status_code not in (200, 204):
        raise HTTPException(400, "Gagal menghapus pembelian")
    return {"ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
