"""Tests for new features (iteration 3):
- Attachments upload/download (Emergent object storage)
- Attachments: unsupported extension rejection (.exe -> 400)
- Attachments: cross-client 403
- SSE stream endpoint auth requirement (401 without token)
- Export PDF with diagram_pngs list -> multi-sheet PDF embedding
- Backward compat: existing job with plan.layout (legacy single-sheet)
Note: We DO NOT trigger LLM generation (cost). Main agent already verified SSE end-to-end.
"""
import io
import re
import requests
import pytest

CLIENT_JOB_ID = "b7a59a50-02f4-416b-b313-2b710ac1a2e6"  # client-owned, 2 layouts, has txt attachment
LEGACY_JOB_ID = "67c7cffc-aee6-4b1a-8e0a-272f786f0b8b"  # legacy plan.layout single sheet


# ---------- Attachments ----------
class TestAttachments:
    def test_upload_txt_client_own_job(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        files = {"file": ("TEST_pytest_memo.txt", b"Site memo: coning starts at 07:00 with 2 flaggers.", "text/plain")}
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments", files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) >= {"id", "filename", "size", "content_type"}
        assert d["filename"] == "TEST_pytest_memo.txt"
        assert d["size"] > 0
        pytest.att_id_txt = d["id"]

    def test_download_txt_roundtrip(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        att_id = getattr(pytest, "att_id_txt", None)
        assert att_id, "prior upload failed"
        r = s.get(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments/{att_id}", timeout=30)
        assert r.status_code == 200
        assert r.content == b"Site memo: coning starts at 07:00 with 2 flaggers."
        cd = r.headers.get("content-disposition", "")
        assert "TEST_pytest_memo.txt" in cd

    def test_upload_png_client_own_job(self, api_url, client_token):
        # tiny 1x1 PNG bytes
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (1, 1), (255, 0, 0)).save(buf, format="PNG")
        png_bytes = buf.getvalue()
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        files = {"file": ("TEST_pytest_tiny.png", png_bytes, "image/png")}
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments", files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["filename"] == "TEST_pytest_tiny.png"
        assert d["size"] == len(png_bytes)
        pytest.att_id_png = d["id"]

    def test_download_png_roundtrip(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        att_id = getattr(pytest, "att_id_png", None)
        assert att_id
        r = s.get(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments/{att_id}", timeout=30)
        assert r.status_code == 200
        # PNG magic bytes
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_upload_unsupported_ext_rejected(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        files = {"file": ("evil.exe", b"MZ\x90\x00 fake exe", "application/octet-stream")}
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments", files=files, timeout=15)
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Unsupported" in detail or "allowed" in detail.lower()

    def test_upload_no_extension_rejected(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        files = {"file": ("noext", b"random bytes", "text/plain")}
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments", files=files, timeout=15)
        assert r.status_code == 400

    def test_upload_other_client_job_403(self, api_url, client_token, admin_client):
        """Admin creates a job owned by admin — client cannot upload to it."""
        r = admin_client.post(f"{api_url}/jobs", json={
            "title": "TEST_ admin-only job for 403 check",
            "location": "TEST BC",
            "works_type": "Line painting",
        }, timeout=15)
        assert r.status_code == 200
        admin_job_id = r.json()["id"]

        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}"})
        files = {"file": ("test.txt", b"hello", "text/plain")}
        r2 = s.post(f"{api_url}/jobs/{admin_job_id}/attachments", files=files, timeout=15)
        # /api/jobs/{id}/attachments: raises 404 for non-owner client (due to job lookup filter),
        # per server.py the check reads job (unfiltered) then checks client_id -> 403
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"

    def test_download_no_auth_401(self, api_url):
        r = requests.get(f"{api_url}/jobs/{CLIENT_JOB_ID}/attachments/anything", timeout=10)
        assert r.status_code == 401


# ---------- SSE stream endpoint ----------
class TestSSEAuth:
    def test_sse_requires_auth_401(self, api_url):
        r = requests.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/generate/stream",
                          json={"model": "gpt-5.2"}, timeout=10)
        assert r.status_code == 401


# ---------- Export with diagram_pngs (multi-sheet) ----------
class TestMultiSheetExport:
    def _tiny_png_data_url(self, color=(0, 128, 255)):
        from PIL import Image
        import base64
        buf = io.BytesIO()
        Image.new("RGB", (300, 200), color).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    def test_export_multi_layout_with_2_pngs(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"})
        pngs = [self._tiny_png_data_url((0, 128, 255)), self._tiny_png_data_url((255, 128, 0))]
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/export",
                   json={"diagram_pngs": pngs}, timeout=30)
        assert r.status_code == 200, r.text
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:5] == b"%PDF-"
        # Look for embedded images and multi-sheet strings within the PDF payload
        # PDF should contain "Sheet TC-" markers for each layout page (2 sheets)
        content = r.content
        # PDF might have compressed streams; check for Image XObject count instead
        n_images = content.count(b"/Subtype /Image") + content.count(b"/Subtype/Image")
        assert n_images >= 2, f"Expected >=2 embedded images in PDF, found {n_images}"

    def test_export_no_pngs_still_works(self, api_url, client_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"})
        r = s.post(f"{api_url}/jobs/{CLIENT_JOB_ID}/export", json={}, timeout=30)
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"


# ---------- Backward compat ----------
class TestLegacyLayout:
    def test_legacy_job_has_plan_layout(self, api_url, reviewer_token):
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {reviewer_token}"})
        r = s.get(f"{api_url}/jobs/{LEGACY_JOB_ID}", timeout=15)
        assert r.status_code == 200, r.text
        job = r.json()
        plan = job.get("plan") or {}
        # legacy shape: single 'layout' dict (no 'layouts' array)
        assert plan.get("layout") is not None, "Expected legacy plan.layout"
        assert isinstance(plan["layout"], dict)
        # frontend normalizes: plan.layouts || [plan.layout]
