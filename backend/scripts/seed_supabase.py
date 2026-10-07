"""Idempotent demo seed: 2 outlets, products, owner + cashier accounts."""
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from supabase_admin import client  # noqa: E402

OUTLETS = [
    {"name": "CS Qasir Kemang", "address": "Jl. Kemang Raya No. 12, Jakarta Selatan"},
    {"name": "CS Qasir Dago", "address": "Jl. Ir. H. Juanda No. 88, Bandung"},
]
PRODUCTS = [
    ("Kopi Susu Gula Aren", "KSA-01", 18000, 40),
    ("Es Teh Manis", "ETM-01", 8000, 60),
    ("Nasi Goreng Spesial", "NGS-01", 25000, 20),
    ("Indomie Goreng Telur", "IGT-01", 12000, 30),
    ("Roti Bakar Coklat Keju", "RBC-01", 15000, 15),
    ("Air Mineral 600ml", "AMN-01", 5000, 100),
    ("Pisang Goreng (Stok Tipis)", "PGR-01", 10000, 2),
]
USERS = [
    ("siagas981@gmail.com", "Qasir#Owner2026", "Owner", "owner", None),
    ("cashier@csqasir.test", "Qasir#Cashier2026", "Kasir Kemang", "cashier", 0),
]


async def main():
    async with client() as c:
        outlet_ids = []
        for o in OUTLETS:
            r = await c.get("/rest/v1/outlets", params={"name": f"eq.{o['name']}", "select": "id"})
            rows = r.json()
            if not rows:
                rows = (await c.post("/rest/v1/outlets", json=o, headers={"Prefer": "return=representation"})).json()
            outlet_ids.append(rows[0]["id"])
            existing = (await c.get("/rest/v1/products", params={"outlet_id": f"eq.{rows[0]['id']}", "select": "id"})).json()
            if not existing:
                await c.post("/rest/v1/products", json=[
                    {"outlet_id": rows[0]["id"], "name": n, "sku": s, "price": p, "stock": st} for n, s, p, st in PRODUCTS
                ])
        users = (await c.get("/auth/v1/admin/users", params={"per_page": 1000})).json()["users"]
        by_email = {u["email"]: u["id"] for u in users}
        for email, pw, name, role, oi in USERS:
            uid = by_email.get(email)
            if not uid:
                r = await c.post("/auth/v1/admin/users", json={
                    "email": email, "password": pw, "email_confirm": True, "user_metadata": {"full_name": name}})
                r.raise_for_status()
                uid = r.json()["id"]
            else:
                await c.put(f"/auth/v1/admin/users/{uid}", json={"password": pw})
            r = await c.patch("/rest/v1/profiles", params={"id": f"eq.{uid}"}, json={
                "role": role, "full_name": name, "outlet_id": outlet_ids[oi] if oi is not None else None})
            r.raise_for_status()
            print(f"{role}: {email} ok")
        print("outlets:", outlet_ids)


asyncio.run(main())
