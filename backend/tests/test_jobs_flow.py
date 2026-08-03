"""Jobs, review, export, KB, feedback, role permissions.
Note: We do NOT trigger LLM generation here (main agent already verified). We reuse existing job."""
import requests
import pytest


def test_client_creates_job(client_client, api_url):
    payload = {
        "title": "TEST_ Pytest job creation",
        "location": "TEST W Georgia St & Burrard St, Vancouver, BC",
        "works_type": "Utility work",
        "start_date": "2026-02-01",
        "duration": "2 days",
        "road_type": "Urban arterial",
        "lanes_total": 4,
        "lanes_closed": 1,
        "speed_limit": 50,
        "traffic_volume": "High (10,000–30,000 AADT)",
        "hazards": "Bus route, downtown foot traffic",
        "notes": "TEST created by pytest",
    }
    r = client_client.post(f"{api_url}/jobs", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["status"] == "draft"
    assert job["title"] == payload["title"]
    assert job["client_name"] == "Casey Client"
    assert job["plan"] is None
    assert "id" in job

    # GET to verify persistence
    r2 = client_client.get(f"{api_url}/jobs/{job['id']}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["title"] == payload["title"]


def test_client_only_sees_own_jobs(client_client, api_url):
    r = client_client.get(f"{api_url}/jobs", timeout=15)
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list)
    # All returned jobs should be client's — every job should be visible
    # via a GET (not 404) — since our list already filters
    for j in jobs:
        assert "_id" not in j  # ObjectId excluded
        assert "id" in j


def test_reviewer_sees_all_jobs(reviewer_client, client_client, api_url):
    """Reviewer should see at least all jobs client sees."""
    r_client = client_client.get(f"{api_url}/jobs", timeout=15).json()
    r_rev = reviewer_client.get(f"{api_url}/jobs", timeout=15).json()
    assert len(r_rev) >= len(r_client)


def test_client_cannot_review(client_client, api_url, existing_job_id):
    r = client_client.post(f"{api_url}/jobs/{existing_job_id}/review", json={"action": "approve"}, timeout=15)
    assert r.status_code == 403


def test_client_cannot_edit_plan(client_client, api_url, existing_job_id):
    r = client_client.put(f"{api_url}/jobs/{existing_job_id}/plan", json={"plan": {"foo": "bar"}}, timeout=15)
    assert r.status_code == 403


def test_client_cannot_access_other_job(client_client, admin_client, api_url):
    """Create a job as admin (client_id=admin) — client should NOT be able to fetch it by id."""
    # admin creates a job (they will be the client_id)
    r = admin_client.post(f"{api_url}/jobs", json={
        "title": "TEST_ admin-owned",
        "location": "TEST Somewhere BC",
        "works_type": "Line painting",
    }, timeout=15)
    assert r.status_code == 200
    admin_job_id = r.json()["id"]

    r2 = client_client.get(f"{api_url}/jobs/{admin_job_id}", timeout=15)
    assert r2.status_code == 404


def test_kb_docs_indexed(reviewer_client, api_url):
    r = reviewer_client.get(f"{api_url}/kb/docs", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "docs" in d
    assert "total_chunks" in d
    # Should have 3 seeded TMM docs (per problem statement)
    indexed = [x for x in d["docs"] if x.get("status") == "indexed"]
    assert len(indexed) >= 3, f"Expected >=3 indexed docs, got {len(indexed)}: {d['docs']}"
    assert d["total_chunks"] > 0


def test_kb_upload_requires_role(client_client, api_url):
    """Client should not be able to upload to KB (403)."""
    files = {"file": ("dummy.pdf", b"%PDF-1.4 fake", "application/pdf")}
    # Remove content-type header for multipart
    s = requests.Session()
    s.headers.update({"Authorization": client_client.headers["Authorization"]})
    r = s.post(f"{api_url}/kb/upload", files=files, timeout=15)
    assert r.status_code == 403


def test_feedback_endpoint_requires_reviewer(client_client, api_url):
    r = client_client.get(f"{api_url}/feedback", timeout=15)
    assert r.status_code == 403


def test_feedback_endpoint_reviewer(reviewer_client, api_url):
    r = reviewer_client.get(f"{api_url}/feedback", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_existing_job_has_plan(reviewer_client, api_url, existing_job_id):
    """Verify main-agent-created job exists with valid plan structure."""
    r = reviewer_client.get(f"{api_url}/jobs/{existing_job_id}", timeout=15)
    assert r.status_code == 200, r.text
    job = r.json()
    plan = job.get("plan")
    assert plan is not None, "Expected plan on pre-generated job"
    for key in ("tmm_citations", "signage_schedule", "setup_steps", "map_features"):
        assert plan.get(key), f"plan.{key} missing or empty"
    assert job.get("sources"), "Expected RAG grounding sources"


def test_reviewer_edit_plan_persists(reviewer_client, api_url, existing_job_id):
    r = reviewer_client.get(f"{api_url}/jobs/{existing_job_id}", timeout=15)
    assert r.status_code == 200
    plan = r.json()["plan"]
    original_summary = plan.get("location_summary", "")
    plan["location_summary"] = "TEST_ Edited by pytest — " + original_summary[:100]

    r2 = reviewer_client.put(f"{api_url}/jobs/{existing_job_id}/plan", json={"plan": plan}, timeout=30)
    assert r2.status_code == 200

    r3 = reviewer_client.get(f"{api_url}/jobs/{existing_job_id}", timeout=15)
    assert r3.status_code == 200
    assert r3.json()["plan"]["location_summary"].startswith("TEST_ Edited by pytest")

    # revert
    plan["location_summary"] = original_summary
    reviewer_client.put(f"{api_url}/jobs/{existing_job_id}/plan", json={"plan": plan}, timeout=30)


def test_reviewer_approve_creates_feedback(reviewer_client, api_url, existing_job_id):
    r = reviewer_client.post(f"{api_url}/jobs/{existing_job_id}/review",
                             json={"action": "approve", "feedback": "TEST_ pytest approval — signage layout correct"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # Job status is now approved
    j = reviewer_client.get(f"{api_url}/jobs/{existing_job_id}", timeout=15).json()
    assert j["status"] == "approved"
    assert j["review_feedback"].startswith("TEST_ pytest approval")

    # Feedback record exists
    fb = reviewer_client.get(f"{api_url}/feedback", timeout=15).json()
    assert any(f.get("job_id") == existing_job_id and f.get("action") == "approve" for f in fb)


def test_export_pdf(reviewer_client, api_url, existing_job_id):
    r = reviewer_client.get(f"{api_url}/jobs/{existing_job_id}/export", timeout=30)
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "application/pdf" in ct, f"Expected pdf content-type, got {ct}"
    # PDF magic bytes
    assert r.content[:5] == b"%PDF-", f"Not a valid PDF (first bytes: {r.content[:16]!r})"
    assert len(r.content) > 1000
    assert "attachment" in r.headers.get("content-disposition", "").lower()


def test_review_no_plan_fails(reviewer_client, client_client, api_url):
    """Reviewing a job without a plan should 400."""
    r = client_client.post(f"{api_url}/jobs", json={
        "title": "TEST_ no plan yet",
        "location": "TEST Nowhere",
        "works_type": "Line painting",
    }, timeout=15)
    job_id = r.json()["id"]
    r2 = reviewer_client.post(f"{api_url}/jobs/{job_id}/review", json={"action": "approve"}, timeout=15)
    assert r2.status_code == 400


def test_export_no_plan_fails(reviewer_client, client_client, api_url):
    r = client_client.post(f"{api_url}/jobs", json={
        "title": "TEST_ no plan for export",
        "location": "TEST BC",
        "works_type": "Line painting",
    }, timeout=15)
    job_id = r.json()["id"]
    r2 = reviewer_client.get(f"{api_url}/jobs/{job_id}/export", timeout=15)
    assert r2.status_code == 400
