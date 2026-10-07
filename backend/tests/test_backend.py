"""Backend tests for CS Qasir POS API (health, auth, staff)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://qasir-transactions.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://fqmhxedhluaekglmlgnt.supabase.co"
SUPABASE_ANON = "sb_publishable_ru5Gx1gXAMGLVqpoxpec8g_GpiMEbNq"

OWNER_EMAIL = "siagas981@gmail.com"
OWNER_PASS = "Qasir#Owner2026"
CASHIER_EMAIL = "cashier@csqasir.test"
CASHIER_PASS = "Qasir#Cashier2026"
KEMANG_ID = "daf1d559-c067-49b7-9ae9-d3ff96893149"
DAGO_ID = "87aab4db-13a9-4fed-b00c-495bfdb46965"


def _login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def owner_token():
    return _login(OWNER_EMAIL, OWNER_PASS)


@pytest.fixture(scope="session")
def cashier_token():
    return _login(CASHIER_EMAIL, CASHIER_PASS)


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_health_supabase_ok(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("supabase") == "ok", data


# ---------- Staff endpoint auth ----------
class TestStaffAuth:
    def test_staff_no_token_401(self):
        r = requests.post(f"{BASE_URL}/api/staff", json={
            "email": "x@test.com", "password": "abcdefgh", "outlet_id": KEMANG_ID
        }, timeout=15)
        assert r.status_code == 401

    def test_staff_cashier_forbidden_403(self, cashier_token):
        r = requests.post(
            f"{BASE_URL}/api/staff",
            headers={"Authorization": f"Bearer {cashier_token}"},
            json={"email": "x@test.com", "password": "abcdefgh", "outlet_id": KEMANG_ID},
            timeout=15,
        )
        assert r.status_code == 403


# ---------- RLS checks via Supabase REST ----------
def _rest(token, path, method="GET", **kw):
    return requests.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={
            "apikey": SUPABASE_ANON,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            **kw.pop("headers", {}),
        },
        timeout=30,
        **kw,
    )


class TestRLS:
    def test_owner_sees_two_outlets(self, owner_token):
        r = _rest(owner_token, "outlets?select=id,name")
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_cashier_sees_one_outlet(self, cashier_token):
        r = _rest(cashier_token, "outlets?select=id,name")
        assert r.status_code == 200
        outlets = r.json()
        assert len(outlets) == 1
        assert outlets[0]["id"] == KEMANG_ID

    def test_cashier_stock_patch_blocked(self, cashier_token):
        # Try to patch stock via REST — should return [] (no rows affected due to RLS)
        r = _rest(
            cashier_token,
            f"products?outlet_id=eq.{KEMANG_ID}&limit=1",
            method="PATCH",
            json={"stock": 999999},
            headers={"Prefer": "return=representation"},
        )
        # Must not successfully update any rows
        assert r.status_code in (200, 204, 401, 403), r.text
        if r.status_code == 200:
            assert r.json() == [], f"RLS violation: cashier updated product stock: {r.text}"

    def test_cashier_checkout_other_outlet_forbidden(self, cashier_token):
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/checkout",
            headers={
                "apikey": SUPABASE_ANON,
                "Authorization": f"Bearer {cashier_token}",
                "Content-Type": "application/json",
            },
            json={"p_outlet_id": DAGO_ID, "p_items": [], "p_cash_received": 0, "p_client_ref": "TEST_forbid_1"},
            timeout=15,
        )
        # Should error out with FORBIDDEN_OUTLET
        assert r.status_code >= 400 or "FORBIDDEN_OUTLET" in r.text, r.text


# ---------- Oversell protection via RPC ----------
class TestOversell:
    def test_insufficient_stock(self, cashier_token):
        # Find low-stock product
        p = _rest(cashier_token, f"products?outlet_id=eq.{KEMANG_ID}&sku=eq.PGR-01&select=id,stock,price")
        assert p.status_code == 200 and p.json(), p.text
        prod = p.json()[0]
        huge_qty = prod["stock"] + 999
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/checkout",
            headers={
                "apikey": SUPABASE_ANON,
                "Authorization": f"Bearer {cashier_token}",
                "Content-Type": "application/json",
            },
            json={
                "p_outlet_id": KEMANG_ID,
                "p_items": [{"product_id": prod["id"], "qty": huge_qty, "unit_price": prod["price"]}],
                "p_cash_received": prod["price"] * huge_qty,
                "p_client_ref": "TEST_oversell_1",
            },
            timeout=15,
        )
        assert r.status_code >= 400 or "INSUFFICIENT_STOCK" in r.text, r.text
