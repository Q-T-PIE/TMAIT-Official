import os
import uuid
import logging
import httpx
import numpy as np
from datetime import datetime, timezone
from pypdf import PdfReader
from database import db

logger = logging.getLogger("rag")
EMBED_MODEL = "text-embedding-3-small"
KB_DIR = os.path.join(os.path.dirname(__file__), "kb_docs")

BUILTIN_DOCS = [
    ("2-2020-tmm-part-a.pdf", "TMM 2020 Part A - Traffic Management (BC MoTI)"),
    ("3-2020-tmm-part-b.pdf", "TMM 2020 Part B - Traffic Control (BC MoTI)"),
    ("4-2020-tmm-traffic-control-layouts.pdf", "TMM 2020 Traffic Control Layouts (BC MoTI)"),
]


async def embed_texts(texts: list) -> list:
    key = os.environ["OPENAI_API_KEY"]
    results = []
    async with httpx.AsyncClient(timeout=120) as client:
        for i in range(0, len(texts), 64):
            batch = [t[:8000] for t in texts[i:i + 64]]
            r = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": EMBED_MODEL, "input": batch},
            )
            r.raise_for_status()
            results.extend([d["embedding"] for d in r.json()["data"]])
    return results


def extract_chunks(path: str, chunk_size: int = 2500, overlap: int = 250) -> list:
    reader = PdfReader(path)
    chunks = []
    buf, buf_page = "", 1
    for pnum, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        if not buf:
            buf_page = pnum
        buf += "\n" + text
        while len(buf) >= chunk_size:
            chunks.append({"page": buf_page, "text": buf[:chunk_size]})
            buf = buf[chunk_size - overlap:]
            buf_page = pnum
    if buf.strip():
        chunks.append({"page": buf_page, "text": buf})
    return chunks


async def index_document(path: str, title: str, filename: str) -> dict:
    doc_id = str(uuid.uuid4())
    doc = {
        "id": doc_id, "title": title, "filename": filename, "status": "indexing",
        "chunk_count": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.kb_docs.insert_one({**doc})
    try:
        chunks = extract_chunks(path)
        if chunks:
            embeddings = await embed_texts([c["text"] for c in chunks])
            records = [
                {"id": str(uuid.uuid4()), "doc_id": doc_id, "doc_title": title,
                 "page": c["page"], "text": c["text"], "embedding": e}
                for c, e in zip(chunks, embeddings)
            ]
            await db.kb_chunks.insert_many(records)
        await db.kb_docs.update_one({"id": doc_id}, {"$set": {"status": "indexed", "chunk_count": len(chunks)}})
        logger.info(f"Indexed {title}: {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Indexing failed for {title}: {e}")
        await db.kb_docs.update_one({"id": doc_id}, {"$set": {"status": "failed", "error": str(e)}})
    doc = await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})
    return doc


async def index_builtin_docs():
    count = await db.kb_docs.count_documents({"status": "indexed"})
    if count > 0:
        return
    for filename, title in BUILTIN_DOCS:
        path = os.path.join(KB_DIR, filename)
        if os.path.exists(path):
            existing = await db.kb_docs.find_one({"filename": filename, "status": {"$in": ["indexed", "indexing"]}})
            if not existing:
                await index_document(path, title, filename)


async def search_kb(query: str, k: int = 8) -> list:
    q_emb = (await embed_texts([query]))[0]
    cursor = db.kb_chunks.find({}, {"_id": 0, "doc_title": 1, "page": 1, "text": 1, "embedding": 1})
    chunks = await cursor.to_list(20000)
    if not chunks:
        return []
    matrix = np.array([c["embedding"] for c in chunks])
    q = np.array(q_emb)
    sims = matrix @ q / (np.linalg.norm(matrix, axis=1) * np.linalg.norm(q) + 1e-9)
    top_idx = np.argsort(sims)[::-1][:k]
    return [
        {"doc_title": chunks[i]["doc_title"], "page": chunks[i]["page"],
         "text": chunks[i]["text"], "score": float(sims[i])}
        for i in top_idx
    ]
