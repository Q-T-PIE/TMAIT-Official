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
- **Iteration 4 (2026-06, all ✅ DONE, tested iteration_4 100%):**
  - ATOM Training dashboard modal (reviewer/admin): feedback stats + list, "In active prompt" badge on 3 most recent (injected into generations)
  - Admin User Management modal: list users + job counts, role changes (PATCH /api/users/{id}), delete with confirm, self-protection
  - KB doc controls: per-doc Reindex + Delete (DELETE /api/kb/docs/{id}, POST /api/kb/docs/{id}/reindex); built-in TMM files preserved on disk
- **Iteration 5 (2026-06, ✅ DONE):**
  - Email notifications (Resend): reviewers+admins emailed when a plan hits pending_review (both generate endpoints, fire-and-forget). PRODUCTION MODE since iteration 5b: domain steel-toe-society.com already verified in user's Resend account; SENDER_EMAIL="TMAIT <notifications@steel-toe-society.com>", NOTIFY_TEST_RECIPIENT removed — emails go to real reviewer/admin addresses. NOTE: seeded accounts use fake @tmait.ca emails which will bounce; user should register/update accounts with real emails.
  - Admin-elevation confirm step in User Management (inline confirm before granting admin)
- **Iteration 6 (2026-06, code review fixes ✅ DONE, tested iteration_5 100% — 42/42 backend, 8/8 flows):**
  - Auth hardened: localStorage tokens removed — httpOnly cookie auth only (axios withCredentials, SSE credentials:'include'); Bearer header still accepted server-side for API tests
  - Hook dependency fixes (useCallback load in UserManagement/KnowledgeBase), memoized AuthContext value, error logging in previously-empty catch blocks
  - Stable React keys (content-derived) across PlanDocument/TrafficMap/SchematicDiagram/Dashboard/ActionsPanel/UserManagement
  - Complexity extraction: GeneratingCard component, lib/sse.js streamGeneration, collectLayoutPngs helper, pdf_export _styled_table helper
  - Report false positives NOT changed: server.py `is None` (idiomatic), vendored shadcn use-toast.js
- **Iteration 7 (2026-06, refactor verification ✅ DONE, tested iteration_7 100% — 42/42 backend, all UI flows):**
  - Verified Code Quality Report refactor end-to-end: Dashboard split (JobHeader/PlanWorkspace/useJobs), SchematicDiagram + layoutGeometry.js extraction, backend pdf_export/atom/server helper extraction — no regressions
  - Removed dead code in atom.py, added type hints to pdf_export helpers
  - A11y: role="tab"/aria-selected on workspace tabs, role="dialog"/aria-modal on admin modals
  - Cleaned 5 leftover TEST_ jobs from DB
- **Iteration 8 (2026-06, Code Quality Report wave 2 ✅ DONE, tested iteration_8 100% frontend + 42/42 backend pytest):**
  - Dashboard split further: new `hooks/usePlanGeneration.js` (SSE generation state) + `components/WorkspaceStates.js` (EmptyWorkspace/JobView/NoPlanCard); modal state consolidated to single `modal` var
  - SchematicDiagram split into layer sub-components (SvgDefs/RoadBase/WorkZoneLayer/SignsLayer/DimsLayer/LaneLine/ArrowBoard/MissingLayout); layoutGeometry.js split into focused helpers (extractDims/laneConfig/horizontalFrame/verticalFrame/buildCones/zoneLabels)
  - RequestForm (SiteFields/TrafficFields/AttachmentsField + createJobWithAttachments), Login (LoginHero/Branding/ModeTabs/submitLabel), KnowledgeBase (useKbDocs hook + DocRow), UserManagement (UserRow/ElevateConfirm/DeleteCell), GeneratingCard (StageBadge/badgeClass) all decomposed
  - Nested ternaries removed (Login/GeneratingCard/ActionsPanel generateLabel helper); TrafficMap useMemo deps fixed + Marker position extracted; AuthContext logout catch now logs error; stable setState deps added (useJobs/AuthContext/TrainingDashboard/KnowledgeBase/UserManagement/use-toast)
  - Backend: atom.py stream_generate split into _retrieve_context/_build_prompt/_make_chat; test_existing_job_has_plan simplified with key loop
  - Report FALSE POSITIVES not changed (documented): Python `is None`/`is not None` checks (server.py:476, tests) are idiomatic identity checks against None per PEP 8 — converting to `==` would be a regression; hook "dependencies" like `r`, `data`, `e`, `timer`, `index` are local variables/params and cannot be dependencies; `api`/`apiError`/`listeners` are module-scope constants that eslint exhaustive-deps correctly excludes
- P2: Explicit 400 on register with disallowed role (currently coerced to client)
- P2: CORS explicit origins for production deploy
- P2: KB doc delete/reindex controls ✅ DONE (iteration 4)
- ✅ Reject → revise → regenerate loop (rejection feedback + previous plan injected into revision prompt)

## Notes
- Frontend is React JS (template is CRA JS, not TS) — functionality identical to spec.
- ATOM "training" v1 = feedback store injected into prompts (as per assumption in spec).
