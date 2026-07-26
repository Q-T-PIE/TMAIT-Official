# TMAIT — Traffic Management AI Tool (powered by A.T.O.M) — PRD

## Original Problem Statement
Web app where clients submit traffic-management requests via a form; A.T.O.M (AI) generates a structured, standards-compliant traffic plan grounded in the BC TMM 2020 (RAG), with a visual map-based traffic setup diagram. Reviewers approve/reject/edit plans; approvals + corrections feed an ATOM training loop. Export final plan as PDF. Three-panel UI: Jobs / Workspace / Actions.

## User Choices
- Region/standard: **British Columbia, Canada — TMM 2020** (BC MoTI). Official PDFs downloaded from gov.bc.ca (Part A, Part B, Traffic Control Layouts) and auto-indexed.
- Diagram: **Map-based (Leaflet)** with signage/closure/detour markers.
- Auth: **JWT custom auth** (roles: client, reviewer, admin).
- AI: **User's own keys** — OpenAI `gpt-5.2` (primary) + Anthropic `claude-fable-5` (selectable). Keys in backend/.env.

## Architecture
- FastAPI backend (port 8001, /api prefix) + React frontend + MongoDB.
- `backend/server.py` routes; `atom.py` LLM plan generation (emergentintegrations LlmChat, stream aggregated); `rag.py` PDF chunking + OpenAI embeddings (text-embedding-3-small) + cosine search in MongoDB `kb_chunks`; `auth.py` JWT/bcrypt; `pdf_export.py` reportlab.
- Geocoding: Nominatim (free) for site coordinates → map center.
- Collections: users, jobs, kb_docs, kb_chunks, feedback.
- Job statuses: draft → generating → pending_review → approved/rejected.
- Training loop: approvals/rejections/plan-edits stored in `feedback`; last 3 injected into generation prompt.

## Implemented (2026-06 / first build)
- JWT auth (login/register/me/logout), seeded users (see /app/memory/test_credentials.md)
- Client request form (location, works type, duration, lanes, speed, volume, hazards, notes)
- ATOM plan generation with RAG grounding: structured JSON plan (summary, closures, detours, signage schedule, setup steps, safety, TMM citations, map features)
- Jobs sidebar with live statuses; three-panel Command Center UI (dark/light hybrid, Chivo/IBM Plex/JetBrains Mono)
- Leaflet map diagram (markers by type, closure/detour polylines, legend)
- Review workflow: approve/reject with feedback, reviewer plan editing (Save Corrections)
- Knowledge base: 3 built-in TMM 2020 docs auto-indexed (289 chunks) + admin/reviewer PDF upload
- PDF export (reportlab) with all sections + citations + marker coordinates
- Tested: iteration_1 — 100% backend (25/25) and frontend pass

## Backlog / Next Tasks
- **Iteration 3 (2026-06, all ✅ DONE, tested iteration_3 100% — 37/37 backend + all UI flows):**
  - Multi-sheet layouts: plan.layouts array (one TC sheet per intersection approach/stage), sheet selector tabs TC-1/TC-2, all sheets embedded in exported PDF; legacy plan.layout backward compatible
  - Request-form attachments: pdf/png/jpg/jpeg/webp/txt ≤10MB via Emergent Object Storage (EMERGENT_LLM_KEY), downloadable chips in workspace, PDF/txt text excerpts fed into ATOM generation prompt
  - Streaming generation: SSE POST /api/jobs/{id}/generate/stream (stage/delta/done/error events), frontend live stage badges + streaming text preview
- P1: Include map snapshot image inside exported PDF ✅ DONE differently — TMM schematic Layout Diagram (SVG) embedded as PNG in PDF
- **TMM Layout Diagram (2026-06):** New "Layout Diagram" workspace tab — SVG traffic control layout sheet matching BC TMM 2020 conventions: diamond signs with real C-designations, cone taper (LM), buffer (B), hatched work area, downstream taper (LD), sign spacing (A) per TMM Tables A/B by speed, TCP/FAB symbols, legend, title block. Plan JSON extended with `layout` spec. Diagram captured browser-side (svgToPng) and embedded in exported PDF (POST /api/jobs/{id}/export). Tested: iteration_2 — 100% pass.
- P2: Admin user management UI; feedback/training dashboard page
- P2: Reject → revise → regenerate loop UX ✅ DONE (rejection feedback + previous plan injected into revision prompt; "Revise & Regenerate" button)
- P2: Explicit 400 on register with disallowed role (currently coerced to client)
- P2: CORS explicit origins for production deploy
- P2: KB doc delete/reindex controls

## Notes
- Frontend is React JS (template is CRA JS, not TS) — functionality identical to spec.
- ATOM "training" v1 = feedback store injected into prompts (as per assumption in spec).
