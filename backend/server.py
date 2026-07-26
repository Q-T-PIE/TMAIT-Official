from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import json
import base64
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from fastapi.responses import Response as RawResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import db, client
from auth import hash_password, verify_password, create_access_token, get_current_user, require_roles
import rag
import storage as objstore
from atom import generate_plan, stream_generate
from pdf_export import build_plan_pdf

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="TMAIT API")
api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "client"


class LoginIn(BaseModel):
    email: str
    password: str


class JobIn(BaseModel):
    title: str
    location: str
    works_type: str
    start_date: Optional[str] = None
    duration: Optional[str] = None
    road_type: Optional[str] = None
    lanes_total: Optional[int] = None
    lanes_closed: Optional[int] = None
    speed_limit: Optional[int] = None
    traffic_volume: Optional[str] = None
    hazards: Optional[str] = None
    notes: Optional[str] = None


class GenerateIn(BaseModel):
    model: str = "gpt-5.2"


class PlanUpdateIn(BaseModel):
    plan: dict


class ReviewIn(BaseModel):
    action: str  # approve | reject
    feedback: Optional[str] = None


class ExportIn(BaseModel):
    diagram_png: Optional[str] = None
    diagram_pngs: Optional[list] = None


def set_auth_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


# ---------- Auth ----------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.strip().lower()
    if data.role not in ("client", "reviewer"):
        data.role = "client"
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()), "name": data.name.strip(), "email": email,
        "role": data.role, "created_at": now_iso(),
    }
    await db.users.insert_one({**user, "password_hash": hash_password(data.password)})
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {"user": user, "access_token": token}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.strip().lower()
    record = await db.users.find_one({"email": email})
    if not record or not verify_password(data.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = {k: record[k] for k in ("id", "name", "email", "role", "created_at")}
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {"user": user, "access_token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Jobs ----------
@api.post("/jobs")
async def create_job(data: JobIn, user: dict = Depends(get_current_user)):
    job = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "status": "draft", "client_id": user["id"], "client_name": user["name"],
        "plan": None, "sources": [], "model_used": None, "review_feedback": None,
        "reviewed_by": None, "attachments": [], "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.jobs.insert_one({**job})
    return job


@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user)):
    query = {} if user["role"] in ("reviewer", "admin") else {"client_id": user["id"]}
    jobs = await db.jobs.find(query, {"_id": 0, "plan": 0, "sources": 0, "attachments": 0}).sort("created_at", -1).to_list(500)
    return jobs


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    query = {"id": job_id}
    if user["role"] == "client":
        query["client_id"] = user["id"]
    job = await db.jobs.find_one(query, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@api.post("/jobs/{job_id}/generate")
async def generate(job_id: str, data: GenerateIn, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] == "client" and job["client_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "generating", "updated_at": now_iso()}})
    try:
        result = await generate_plan(job, data.model)
    except Exception as e:
        logger.error(f"Generation failed for {job_id}: {e}")
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "draft", "updated_at": now_iso()}})
        raise HTTPException(status_code=502, detail=f"ATOM generation failed: {str(e)[:300]}")
    update = {
        "plan": result["plan"], "sources": result["sources"], "model_used": result["model_used"],
        "status": "pending_review", "updated_at": now_iso(),
    }
    await db.jobs.update_one({"id": job_id}, {"$set": update})
    return {**job, **update}


def sse(evt: dict) -> str:
    return f"data: {json.dumps(evt)}\n\n"


@api.post("/jobs/{job_id}/generate/stream")
async def generate_stream(job_id: str, data: GenerateIn, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] == "client" and job["client_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    prev_status = job["status"]
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "generating", "updated_at": now_iso()}})

    async def gen():
        try:
            async for evt in stream_generate(job, data.model):
                if evt["type"] == "result":
                    await db.jobs.update_one({"id": job_id}, {"$set": {
                        "plan": evt["plan"], "sources": evt["sources"], "model_used": evt["model_used"],
                        "status": "pending_review", "updated_at": now_iso(),
                    }})
                    full = await db.jobs.find_one({"id": job_id}, {"_id": 0})
                    yield sse({"type": "done", "job": full})
                else:
                    yield sse(evt)
        except Exception as e:
            logger.error(f"Stream generation failed for {job_id}: {e}")
            await db.jobs.update_one({"id": job_id}, {"$set": {"status": prev_status if prev_status != "generating" else "draft", "updated_at": now_iso()}})
            yield sse({"type": "error", "detail": f"ATOM generation failed: {str(e)[:300]}"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


ALLOWED_ATT_EXT = {"pdf", "png", "jpg", "jpeg", "webp", "txt"}


@api.post("/jobs/{job_id}/attachments")
async def upload_attachment(job_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["role"] == "client" and job["client_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_ATT_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type — allowed: {', '.join(sorted(ALLOWED_ATT_EXT))}")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit")
    path = f"{objstore.APP_NAME}/uploads/{job_id}/{uuid.uuid4()}.{ext}"
    try:
        result = await objstore.put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        logger.error(f"Attachment upload failed: {e}")
        raise HTTPException(status_code=502, detail="Storage upload failed, please retry")
    excerpt = None
    if ext == "pdf":
        try:
            import io
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            excerpt = "\n".join((p.extract_text() or "") for p in reader.pages[:5]).strip()[:4000] or None
        except Exception:
            excerpt = None
    elif ext == "txt":
        excerpt = data.decode("utf-8", "ignore")[:4000]
    att = {"id": str(uuid.uuid4()), "filename": file.filename, "content_type": file.content_type,
           "size": len(data), "storage_path": result["path"], "text_excerpt": excerpt}
    await db.jobs.update_one({"id": job_id}, {"$push": {"attachments": att}, "$set": {"updated_at": now_iso()}})
    return {k: att[k] for k in ("id", "filename", "content_type", "size")}


@api.get("/jobs/{job_id}/attachments/{att_id}")
async def download_attachment(job_id: str, att_id: str, user: dict = Depends(get_current_user)):
    query = {"id": job_id}
    if user["role"] == "client":
        query["client_id"] = user["id"]
    job = await db.jobs.find_one(query, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    att = next((a for a in (job.get("attachments") or []) if a["id"] == att_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data, ct = await objstore.get_object(att["storage_path"])
    return RawResponse(content=data, media_type=att.get("content_type") or ct,
                       headers={"Content-Disposition": f'attachment; filename="{att["filename"]}"'})


@api.put("/jobs/{job_id}/plan")
async def update_plan(job_id: str, data: PlanUpdateIn, user: dict = Depends(get_current_user)):
    require_roles(user, ["reviewer", "admin"])
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.jobs.update_one({"id": job_id}, {"$set": {"plan": data.plan, "updated_at": now_iso()}})
    await db.feedback.insert_one({
        "id": str(uuid.uuid4()), "job_id": job_id, "job_title": job["title"],
        "action": "edit", "note": "Reviewer manually corrected the generated plan.",
        "reviewer": user["name"], "created_at": now_iso(),
    })
    return {"ok": True}


@api.post("/jobs/{job_id}/review")
async def review_job(job_id: str, data: ReviewIn, user: dict = Depends(get_current_user)):
    require_roles(user, ["reviewer", "admin"])
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be approve or reject")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.get("plan"):
        raise HTTPException(status_code=400, detail="No plan to review")
    status = "approved" if data.action == "approve" else "rejected"
    await db.jobs.update_one({"id": job_id}, {"$set": {
        "status": status, "review_feedback": data.feedback,
        "reviewed_by": user["name"], "updated_at": now_iso(),
    }})
    await db.feedback.insert_one({
        "id": str(uuid.uuid4()), "job_id": job_id, "job_title": job["title"],
        "action": data.action, "note": data.feedback or f"Plan {status} without comment.",
        "reviewer": user["name"], "created_at": now_iso(),
    })
    return {"ok": True, "status": status}


async def _export(job_id: str, user: dict, diagram_pngs: Optional[list] = None):
    query = {"id": job_id}
    if user["role"] == "client":
        query["client_id"] = user["id"]
    job = await db.jobs.find_one(query, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.get("plan"):
        raise HTTPException(status_code=400, detail="No plan to export")
    png_list = []
    for d in (diagram_pngs or []):
        if d and "," in d:
            try:
                png_list.append(base64.b64decode(d.split(",", 1)[1]))
            except Exception:
                pass
    pdf = build_plan_pdf(job, diagram_pngs=png_list or None)
    fname = f"TMAIT_Plan_{job['title'][:30].replace(' ', '_')}.pdf"
    return RawResponse(content=pdf, media_type="application/pdf",
                       headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@api.post("/jobs/{job_id}/export")
async def export_pdf_post(job_id: str, data: ExportIn, user: dict = Depends(get_current_user)):
    pngs = data.diagram_pngs or ([data.diagram_png] if data.diagram_png else None)
    return await _export(job_id, user, pngs)


@api.get("/jobs/{job_id}/export")
async def export_pdf(job_id: str, user: dict = Depends(get_current_user)):
    return await _export(job_id, user)


# ---------- Knowledge Base ----------
@api.get("/kb/docs")
async def kb_docs(user: dict = Depends(get_current_user)):
    docs = await db.kb_docs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    total_chunks = await db.kb_chunks.count_documents({})
    return {"docs": docs, "total_chunks": total_chunks}


@api.post("/kb/upload")
async def kb_upload(file: UploadFile = File(...), title: str = Form(None), user: dict = Depends(get_current_user)):
    require_roles(user, ["admin", "reviewer"])
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    os.makedirs(rag.KB_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename.replace('/', '_')}"
    path = os.path.join(rag.KB_DIR, safe_name)
    with open(path, "wb") as f:
        f.write(await file.read())
    doc = await rag.index_document(path, title or file.filename, safe_name)
    return doc


# ---------- Feedback (training loop) ----------
@api.get("/feedback")
async def list_feedback(user: dict = Depends(get_current_user)):
    require_roles(user, ["reviewer", "admin"])
    return await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/")
async def root():
    return {"service": "TMAIT API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


SEED_USERS = [
    {"name": "Admin", "email_env": "ADMIN_EMAIL", "pass_env": "ADMIN_PASSWORD", "role": "admin"},
    {"name": "Riley Reviewer", "email": "reviewer@tmait.ca", "password": "Review@1234", "role": "reviewer"},
    {"name": "Casey Client", "email": "client@tmait.ca", "password": "Client@1234", "role": "client"},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index("client_id")
    await db.kb_chunks.create_index("doc_id")
    for s in SEED_USERS:
        email = os.environ.get(s["email_env"]) if "email_env" in s else s["email"]
        password = os.environ.get(s["pass_env"]) if "pass_env" in s else s["password"]
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": s["name"], "email": email, "role": s["role"],
                "password_hash": hash_password(password), "created_at": now_iso(),
            })
        elif not verify_password(password, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
    asyncio.create_task(rag.index_builtin_docs())

    async def _init_storage():
        try:
            await objstore.init_storage()
            logger.info("Object storage initialized")
        except Exception as e:
            logger.error(f"Storage init failed: {e}")
    asyncio.create_task(_init_storage())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
