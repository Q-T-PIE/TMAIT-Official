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
  "map_features": {
    "center": {"lat": 0.0, "lng": 0.0},
    "zoom": 16,
    "markers": [{"lat": 0.0, "lng": 0.0, "type": "sign|cone|flagger|barrier|work_zone|detour_sign", "label": "short label"}],
    "closure_path": [[0.0, 0.0], [0.0, 0.0]],
    "detour_path": [[0.0, 0.0], [0.0, 0.0]]
  }
}

Map rules: use the provided site coordinates as center. Place 6-14 markers realistically along the roadway approach and around the work zone (advance warning signs upstream at TMM-compliant spacing ~0.001 deg ≈ 111m, taper cones, flagger stations, work_zone at site). closure_path traces the closed lane segment; detour_path traces detour route if applicable, otherwise empty array. Base signage spacing on the posted speed per TMM tables.
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


async def generate_plan(job: dict, model_key: str) -> dict:
    provider, model, env_key = MODELS.get(model_key, MODELS["gpt-5.2"])
    api_key = os.environ[env_key]

    rag_query = f"{job['works_type']} {job.get('road_type', '')} lane closure speed {job.get('speed_limit', '')} km/h signage traffic control {job.get('traffic_volume', '')} volume"
    context_chunks = await search_kb(rag_query, k=8)
    context = "\n\n".join(
        [f"[{c['doc_title']} — p.{c['page']}]\n{c['text'][:1800]}" for c in context_chunks]
    ) or "No TMM excerpts available yet — rely on BC TMM 2020 standards knowledge and state citations carefully."

    coords = await geocode(job["location"])
    feedback = await get_feedback_examples()

    prompt = f"""JOB REQUEST:
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

TMM 2020 REFERENCE EXCERPTS (retrieved from knowledge base):
{context}

{feedback}

Generate the complete traffic management plan JSON now."""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"plan-{job['id']}",
        system_message=SYSTEM_MESSAGE,
    ).with_model(provider, model)
    if provider == "anthropic":
        chat = chat.with_params(max_tokens=16000)

    text = ""
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            text += ev.content
        elif isinstance(ev, StreamDone):
            break

    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"Model returned no JSON: {text[:300]}")
    plan = json.loads(text[start:end + 1])
    plan.setdefault("map_features", {})
    plan["map_features"].setdefault("center", coords)
    sources = [{"doc_title": c["doc_title"], "page": c["page"], "score": round(c["score"], 3)} for c in context_chunks]
    return {"plan": plan, "sources": sources, "model_used": model_key}
