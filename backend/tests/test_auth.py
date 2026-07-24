"""Health + auth flows"""
import requests
import pytest


def test_root_health(api_url):
    r = requests.get(f"{api_url}/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("service") == "TMAIT API"


def test_login_admin(api_url):
    r = requests.post(f"{api_url}/auth/login", json={"email": "admin@tmait.ca", "password": "Admin@1234"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == "admin@tmait.ca"
    # httpOnly cookie should be set
    assert "access_token" in r.cookies


def test_login_reviewer(api_url):
    r = requests.post(f"{api_url}/auth/login", json={"email": "reviewer@tmait.ca", "password": "Review@1234"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "reviewer"


def test_login_client(api_url):
    r = requests.post(f"{api_url}/auth/login", json={"email": "client@tmait.ca", "password": "Client@1234"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "client"


def test_login_invalid(api_url):
    r = requests.post(f"{api_url}/auth/login", json={"email": "bad@x.com", "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_me_endpoint_requires_auth(api_url):
    r = requests.get(f"{api_url}/auth/me", timeout=15)
    assert r.status_code == 401


def test_me_with_bearer(api_url, client_token):
    r = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["email"] == "client@tmait.ca"
    assert j["role"] == "client"
    # sensitive field must not be present
    assert "password_hash" not in j
    assert "_id" not in j


def test_register_new_client_and_login(api_url):
    import uuid as _u
    email = f"test_{_u.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{api_url}/auth/register", json={
        "name": "TEST User", "email": email, "password": "TestPass@1234", "role": "client"
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "access_token" in d
    assert d["user"]["role"] == "client"
    assert d["user"]["email"] == email.lower()

    # Login with new user
    r2 = requests.post(f"{api_url}/auth/login", json={"email": email, "password": "TestPass@1234"}, timeout=30)
    assert r2.status_code == 200

    # Duplicate register should fail
    r3 = requests.post(f"{api_url}/auth/register", json={
        "name": "TEST User", "email": email, "password": "TestPass@1234", "role": "client"
    }, timeout=30)
    assert r3.status_code == 400


def test_register_admin_role_downgraded(api_url):
    """role=admin is not allowed via /auth/register; server should force client."""
    import uuid as _u
    email = f"TEST_{_u.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{api_url}/auth/register", json={
        "name": "TEST Admin Attempt", "email": email, "password": "TestPass@1234", "role": "admin"
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "client"
