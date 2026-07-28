"""Cookie-based auth regression: login cookie jar must authenticate /auth/me without any Authorization header."""
import requests


def test_cookie_auth_me(api_url):
    """Login as client, then use the returned cookie jar (no Bearer) to hit /auth/me."""
    s = requests.Session()
    r = s.post(f"{api_url}/auth/login", json={"email": "client@tmait.ca", "password": "Client@1234"}, timeout=30)
    assert r.status_code == 200
    # Cookie must be set with correct attributes (httpOnly not visible from requests but presence + secure attrs verified via header)
    set_cookie = r.headers.get("Set-Cookie", "")
    assert "access_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "SameSite=none" in set_cookie or "SameSite=None" in set_cookie
    # /auth/me via cookie jar only (no Authorization header)
    r2 = s.get(f"{api_url}/auth/me", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["email"] == "client@tmait.ca"


def test_cookie_auth_bearer_both_work(api_url):
    """Both Bearer header and cookie jar must independently authenticate /auth/me."""
    r = requests.post(f"{api_url}/auth/login", json={"email": "admin@tmait.ca", "password": "Admin@1234"}, timeout=30)
    assert r.status_code == 200
    token = r.json()["access_token"]
    cookie = r.cookies.get("access_token")
    assert cookie is not None

    # via Bearer (no cookies)
    r1 = requests.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r1.status_code == 200
    assert r1.json()["role"] == "admin"

    # via cookie only (no Authorization header)
    r2 = requests.get(f"{api_url}/auth/me", cookies={"access_token": cookie}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["role"] == "admin"


def test_logout_clears_cookie(api_url):
    """Logout must delete the access_token cookie."""
    s = requests.Session()
    r = s.post(f"{api_url}/auth/login", json={"email": "client@tmait.ca", "password": "Client@1234"}, timeout=30)
    assert r.status_code == 200
    r2 = s.post(f"{api_url}/auth/logout", timeout=15)
    assert r2.status_code == 200
    # /auth/me should now 401 since the cookie was deleted
    # requests keeps deleted cookies (Max-Age=0), so also assert 401 behaviour
    r3 = s.get(f"{api_url}/auth/me", timeout=15)
    assert r3.status_code == 401


def test_users_list_via_cookie_admin(api_url):
    """GET /api/users with cookie-only admin session."""
    s = requests.Session()
    r = s.post(f"{api_url}/auth/login", json={"email": "admin@tmait.ca", "password": "Admin@1234"}, timeout=30)
    assert r.status_code == 200
    r2 = s.get(f"{api_url}/users", timeout=15)
    assert r2.status_code == 200
    data = r2.json()
    assert isinstance(data, list)
    assert any(u["email"] == "admin@tmait.ca" for u in data)


def test_kb_docs_via_cookie(api_url):
    """GET /api/kb/docs works with cookie-only admin session and returns 3 built-in TMM docs."""
    s = requests.Session()
    r = s.post(f"{api_url}/auth/login", json={"email": "admin@tmait.ca", "password": "Admin@1234"}, timeout=30)
    assert r.status_code == 200
    r2 = s.get(f"{api_url}/kb/docs", timeout=15)
    assert r2.status_code == 200
    j = r2.json()
    assert "docs" in j and "total_chunks" in j
    assert len(j["docs"]) >= 3
