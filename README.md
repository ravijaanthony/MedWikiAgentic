# MedWiki — Ambient Medical Intelligence

Buildathon MVP: LangGraph pipeline with VALSEA ingest, LLM refinement (Gemini/OpenAI), parallel specialist agents (Vitals, Safety, Advocate, Clinical), and integrity validation. Polished demo UI included.

**Tagline:** Ambient Medical Intelligence with Human-Centric Safety.

## Quick start (5 minutes)

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
copy .env.example .env     # set DATABASE_URL (required) and optional LLM keys
uvicorn app.main:app --reload --port 8000
```

API: http://127.0.0.1:8000 — health check at `/health` (includes active `llm_provider`)

### Database (Supabase Postgres)

This project requires a Supabase Postgres connection. Free tier works fine.

1. Create a project at [supabase.com](https://supabase.com).
2. Project Settings -> Database -> **Transaction pooler** -> copy the URL (port `6543`).
3. Set `DATABASE_URL` in `backend/.env` (template in `.env.example`):

   ```env
   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
   ```

4. Apply the schema once via Supabase SQL editor with `supabase/migrations/001_patients.sql` (or rely on `init_db()` which auto-creates the table on first request).

The API refuses to start without a valid Postgres URL. Consultation pipeline state is in-memory and is not persisted to the database.

### LLM keys (auto-detect)

The backend picks the LLM provider automatically:

1. **`GEMINI_API_KEY` set** → Google Gemini (`gemini-2.0-flash` by default)
2. Else **`OPENAI_API_KEY` set** → OpenAI (`gpt-4o-mini` by default)
3. Else → heuristic fallbacks (demo still works)

If **both** keys are set, **Gemini is used**. Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

```env
GEMINI_API_KEY=your_key_here
GEMINI_REFINE_MODEL=gemini-2.0-flash
GEMINI_AGENT_MODEL=gemini-2.0-flash
```

A **demo patient** (Mr Tan, penicillin allergy) is seeded on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 (proxies `/api` → backend)

## Demo script (~90 seconds)

1. Open **Onboarding** — note demo patient or create one with allergies.
2. **Consult** → select patient → **Demo fixture** → Run pipeline.
3. **Results** — watch stage stepper; Safety tab shows **penicillin / amoxicillin warn** (warn-only, not block).
4. Click a **citation chip** — transcript highlights verbatim span.
5. **Profile sync** modal — add Amoxicillin to permanent meds.

## Architecture

```
VALSEA ingest → Refine (o1/mini) → Dispatch → Parallel specialists → Merge → Integrity
                     ↑                                                      |
                     └──────── retry (max 1) ─────────────────────────────┘
```

- **Safety:** NIH RxNav (DDI) + OpenFDA (indications) + patient allergy cross-check — always `warn`.
- **Citations:** Every insight requires `verbatim_citation` in ground-truth transcript.
- **Fixtures:** Works without API keys via Singlish demo transcript.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/patients` | List patients |
| POST | `/patients` | Create patient profile |
| POST | `/consultations` | Start pipeline (multipart: patient_id, use_fixture, transcript, audio) |
| GET | `/consultations/{id}` | Poll state |
| GET | `/consultations/{id}/events` | SSE stream |
| POST | `/consultations/{id}/acknowledge-warnings` | Dismiss warnings |

## Tests

```bash
cd backend
pytest
```

The patient CRUD test auto-skips unless `DATABASE_URL` in `backend/.env` is a real Supabase URL (placeholder `[project-ref]` values are detected and skipped).

## Stack (non-negotiable per brief)

- **VALSEA** — transcription (fixture fallback)
- **LangGraph** — orchestration
- **Gemini or OpenAI** — refinement + agents (auto-detect via env keys)
- **RxNav + OpenFDA** — medical validation

## FigJam reference

[Buildathon proposed flow diagram](https://www.figma.com/board/QIbNvjnWmmWZDC5pOdzln6/Buildathon-proposed-flow-diagram)
