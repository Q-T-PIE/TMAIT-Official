import os
import json
import logging
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from rag import search_kb
from database import db

logger = logging.getLogger("atom")

MODELS = {
    "gpt-5.2": ("openai", "gpt-5.2", "OPENAI_API_KEY"),
    "claude-fable-5": ("anthropic", "claude-fable-5", "ANTHROPIC_API_KEY"),
}

SYSTEM_MESSAGE = """You are A.T.O.M (Automated Traffic Operation Manager), an expert traffic management planner for British Columbia, Canada. You generate structured, standards-compliant traffic management plans strictly grounded in the BC Ministry of Transportation and Infrastructure's 2020 Traffic Management Manual for Work on Roadways (TMM 2020).

You MUST respond with ONLY a valid JSON object (no markdown fences, no commentary) matching exactly this schema:
{
  "location_summary": "string - concise description of the site and its traffic context",
  "event_type": "string - classification of the works/event",
  "duration": "string - duration and work windows",
  "road_lane_closures": "string - detailed description of road/lane closures required",
  "detours": "string - detour routing description, or 'No detour required' with justification",
  "signage_schedule": [{"sign": "sign name and BC/MoTI designation e.g. C-001 CONSTRUCTION AHEAD", "location": "placement relative to work zone", "spacing_m": "spacing/distance in metres per TMM tables", "notes": "reflectivity/size/other requirements"}],
  "setup_steps": ["ordered step-by-step site setup instructions"],
  "safety_considerations": "string - hazards, worker safety, flagger requirements, buffer zones",
  "tmm_citations": [{"section": "e.g. TMM 2020 Part B, Section 2.3, p.45", "requirement": "what the standard requires and how this plan complies"}],
  "layouts": [{
    "sheet_title": "string - which approach/stage this sheet covers e.g. 'Northbound approach on Lonsdale Ave'",
    "layout_title": "string e.g. 'Right Lane Closure — Multilane Undivided Roadway, 50 km/h'",
    "reference_layout": "string - the TMM 2020 traffic control layout section this is modelled on",
    "road_name": "string",
    "direction_of_travel": "string e.g. northbound",
    "two_way": true,
    "lanes": 4,
    "closed_lanes_count": 1,
    "closed_side": "right",
    "posted_speed": 50,
    "dimensions": {"sign_spacing_A_m": 40, "buffer_B_m": 30, "merge_taper_LM_m": 35, "downstream_taper_LD_m": 15, "device_spacing_C_m": 10, "work_area_length_m": 60},
    "upstream_signs": [{"designation": "C-018-1A", "name": "CONSTRUCTION AHEAD", "side": "right"}],
    "downstream_signs": [{"designation": "C-086-1", "name": "THANK YOU RESUME SPEED", "side": "right"}],
    "tcp_flaggers": 0,
    "arrow_board": true,
    "notes": "one-line layout note"
  }],
  "map_features": {
    "center": {"lat": 0.0, "lng": 0.0},
    "zoom": 16,
    "markers": [{"lat": 0.0, "lng": 0.0, "type": "sign|cone|flagger|barrier|work_zone|detour_sign", "label": "short label"}],
    "closure_path": [[0.0, 0.0], [0.0, 0.0]],
    "detour_path": [[0.0, 0.0], [0.0, 0.0]]
  }
}

Map rules: use the provided site coordinates as center. Place 6-14 markers realistically along the roadway approach and around the work zone (advance warning signs upstream at TMM-compliant spacing ~0.001 deg ≈ 111m, taper cones, flagger stations, work_zone at site). closure_path traces the closed lane segment; detour_path traces detour route if applicable, otherwise empty array. Base signage spacing on the posted speed per TMM tables.

LAYOUT RULES (schematic drawing spec — must follow BC TMM 2020 exactly):
- Use REAL BC sign designations in both signage_schedule and layout signs. Common ones: C-018-1A CONSTRUCTION AHEAD, C-004 ROAD WORK AHEAD, C-001 TRAFFIC CONTROL PERSON AHEAD, C-029 PREPARE TO STOP, C-030-8 SINGLE LANE TRAFFIC, C-130-L/R LANE CLOSED AHEAD, C-053 LANE CLOSURE ARROW, C-117-L/R LANE SHIFT, C-134 ROAD NARROWS AHEAD, C-132 TWO-WAY TRAFFIC AHEAD, R-004 MAXIMUM SPEED (with C-080-T CONSTRUCTION tab), C-086-1 THANK YOU RESUME SPEED, R-012 ROAD CLOSED, C-027 STOP paddle.
- TMM TABLE A — Merge Taper Length LM by posted speed: ≤50 km/h: 35 m | 60: 55 m | 70: 160 m | 80: 190 m | 90: 210 m | 100: 230 m | 110: 250 m | 120: 280 m. Downstream taper LD ≈ 15-30 m.
- TMM TABLE B — Construction Sign Spacing A: ≤50: 40 m | 60: 60 m | 70: 80 m | 80: 100 m | 90-100: 150 m | 110-120: 200 m. Buffer Space B: ≤50: 30 m | 60: 40 m | 70: 60 m | 80: 80 m | 90: 110 m | 100: 140 m | 110: 170 m | 120: 200 m. Device Spacing C (tapers): ≤60: 10 m | ≥70: 15 m.
- Pick dimensions from these tables for the job's posted speed. upstream_signs ordered as first encountered by drivers (farthest from work area first), typically 3-5 signs. Set tcp_flaggers to 2 for two-lane two-way single-lane-alternating operations, 1 where a TCP controls a movement, else 0. two_way=true for undivided roadways.
- MULTI-SHEET: output exactly 1 layout sheet for simple linear closures. For intersections, multi-approach sites, or staged/phased works you MUST output one SEPARATE sheet per affected approach or stage (2-4 sheets) — never merge multiple approaches into a single sheet. E.g. a signalized intersection affecting eastbound and westbound approaches requires 2 sheets, each with its own sheet_title, direction_of_travel, signs and dimensions.
Ground every requirement in the provided TMM 2020 excerpts and cite them precisely in tmm_citations (minimum 4 citations)."""


async def geocode(location: str) -> dict:
    clean = location.replace("&", "and")
    queries = [f"{clean}, British Columbia, Canada", clean]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for q in queries:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": q, "format": "json", "limit": 1},
                    headers={"User-Agent": "TMAIT/1.0"},
                )
                data = r.json()
                if data:
                    return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as e:
        logger.warning(f"Geocode failed: {e}")
    return {"lat": 49.2827, "lng": -123.1207}


async def get_feedback_examples(limit: int = 3) -> str:
    items = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    if not items:
        return ""
    lines = ["REVIEWER TRAINING FEEDBACK (learn from these past reviews to improve this plan):"]
    for f in items:
        lines.append(f"- [{f['action'].upper()}] Job '{f.get('job_title', '')}': {f.get('note', '')}")
    return "\n".join(lines)


def _attachments_context(job: dict) -> str:
    lines = []
    for a in (job.get("attachments") or []):
        if a.get("text_excerpt"):
            lines.append(f"--- Attachment: {a['filename']} ---\n{a['text_excerpt'][:2500]}")
    return ("CLIENT-PROVIDED ATTACHMENTS (site-specific info to incorporate):\n" + "\n".join(lines)) if lines else ""


def _revision_context(job: dict) -> str:
    if job.get("status") != "rejected" or not job.get("review_feedback"):
        return ""
    prev_plan = json.dumps(job.get("plan") or {}, ensure_ascii=False)[:6000]
    return f"""REVISION REQUEST — the previous plan for THIS job was REJECTED by a reviewer.
You MUST directly address this rejection feedback in the revised plan:
"{job['review_feedback']}"

Previous plan (revise and improve it — keep what was correct, fix what was criticized):
{prev_plan}
"""


def _parse_plan(text: str, coords: dict) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Model returned no JSON: {text[:300]}")
    plan = json.loads(text[start:end + 1])
    plan.setdefault("map_features", {})
    plan["map_features"].setdefault("center", coords)
    return plan


async def _retrieve_context(job: dict) -> tuple:
    rag_query = f"{job['works_type']} {job.get('road_type', '')} lane closure speed {job.get('speed_limit', '')} km/h signage traffic control {job.get('traffic_volume', '')} volume"
    chunks = await search_kb(rag_query, k=8)
    context = "\n\n".join(
        [f"[{c['doc_title']} — p.{c['page']}]\n{c['text'][:1800]}" for c in chunks]
    ) or "No TMM excerpts available yet — rely on BC TMM 2020 standards knowledge and state citations carefully."
    return chunks, context


def _build_prompt(job: dict, coords: dict, context: str, feedback: str) -> str:
    return f"""JOB REQUEST:
- Title: {job['title']}
- Location: {job['location']} (site coordinates: {coords['lat']}, {coords['lng']})
- Works/Event type: {job['works_type']}
- Start date: {job.get('start_date', 'TBD')}
- Duration: {job.get('duration', 'TBD')}
- Road type: {job.get('road_type', 'Unknown')}
- Total lanes: {job.get('lanes_total', '?')} | Lanes to close: {job.get('lanes_closed', '?')}
- Posted speed limit: {job.get('speed_limit', '?')} km/h
- Traffic volume: {job.get('traffic_volume', 'Unknown')}
- Known hazards: {job.get('hazards', 'None stated')}
- Additional notes: {job.get('notes', 'None')}

{_attachments_context(job)}

TMM 2020 REFERENCE EXCERPTS (retrieved from knowledge base):
{context}

{feedback}

{_revision_context(job)}

Generate the complete traffic management plan JSON now."""


def _make_chat(job_id: str, model_key: str) -> LlmChat:
    provider, model, env_key = MODELS.get(model_key, MODELS["gpt-5.2"])
    chat = LlmChat(
        api_key=os.environ[env_key],
        session_id=f"plan-{job_id}",
        system_message=SYSTEM_MESSAGE,
    ).with_model(provider, model)
    if provider == "anthropic":
        chat = chat.with_params(max_tokens=16000)
    return chat


async def stream_generate(job: dict, model_key: str):
    yield {"type": "stage", "stage": "retrieving"}
    context_chunks, context = await _retrieve_context(job)

    yield {"type": "stage", "stage": "geocoding"}
    coords = await geocode(job["location"])
    feedback = await get_feedback_examples()
    prompt = _build_prompt(job, coords, context, feedback)

    yield {"type": "stage", "stage": "drafting"}
    chat = _make_chat(job["id"], model_key)
    text = ""
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            text += ev.content
            yield {"type": "delta", "text": ev.content}
        elif isinstance(ev, StreamDone):
            break

    plan = _parse_plan(text, coords)
    sources = [{"doc_title": c["doc_title"], "page": c["page"], "score": round(c["score"], 3)} for c in context_chunks]
    yield {"type": "result", "plan": plan, "sources": sources, "model_used": model_key}


async def generate_plan(job: dict, model_key: str) -> dict:
    async for evt in stream_generate(job, model_key):
        if evt["type"] == "result":
            return {"plan": evt["plan"], "sources": evt["sources"], "model_used": evt["model_used"]}
    raise ValueError("Generation produced no result")
