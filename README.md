# MedWiki — Ambient Medical Intelligence

Buildathon MVP: LangGraph pipeline with VALSEA ingest, LLM refinement (Gemini/OpenAI), parallel specialist agents (Vitals, Safety, Advocate, Clinical), and integrity validation. Polished demo UI with email-and-password accounts.

**Tagline:** Ambient Medical Intelligence with Human-Centric Safety.

One Supabase auth user == one MedWiki patient. Each user sees only their own profile and consultation history.

## Quick start (~10 minutes)

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (free tier is fine — [supabase.com](https://supabase.com))

### 1. Supabase one-time setup (do this first)

In your Supabase project dashboard:

1. **Authentication → Providers → Email** — enable Email/password sign-in.
2. **Authentication → Settings** — disable **Confirm email** (otherwise signup blocks until the user clicks an email link; the demo flow expects auto-login).
3. **SQL Editor → New query** — paste the contents of [`supabase/migrations/003_user_profiles.sql`](supabase/migrations/003_user_profiles.sql) and run it. This creates `profiles` and `consultations`, both with RLS policies and a foreign key to `auth.users`.
4. **Project Settings → Database → Transaction pooler** (port `6543`) — copy the connection string. This is what the backend uses; the direct `:5432` URL is much slower because it has no pooling.
5. **Project Settings → API**:
   - Copy the **JWT Secret** (under JWT Settings) — backend uses this to verify tokens.
   - Copy the **anon / publishable key** and the **Project URL** — the browser uses these to talk to Supabase Auth.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
copy .env.example .env
```

Edit `backend/.env`:

```env
# Transaction pooler URL from step 4 above (port 6543)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# JWT secret from step 5 above
SUPABASE_JWT_SECRET=eyJhbGciOiJI...

# Optional: at least one for non-heuristic refinement
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Then:

```bash
uvicorn app.main:app --reload --port 8000
```

API: http://127.0.0.1:8000 · health: `/health`. Server refuses to start without `DATABASE_URL` and `SUPABASE_JWT_SECRET`.

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env
```

Edit `frontend/.env` with the values from step 5:

```env
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

Then:

```bash
npm run dev
```

UI: http://localhost:5173 — proxies `/api` → backend.

## Demo flow

1. Open the app → land on **/login** → click **Create an account**.
2. Fill email + password + your patient profile (name, allergies, current meds, age, sex, linguistic signature) → submit.
3. Land on **/dashboard** with profile and empty history.
4. **Start consultation** → **Demo fixture** → run pipeline.
5. **Results** — stage stepper, Safety tab flags penicillin↔amoxicillin, click citations to highlight transcript span, accept/skip the profile-sync modal.
6. Sign out, sign back in → dashboard shows the same consultation in history.

## Architecture

```
Browser (React) ──signUp / signIn──▶ Supabase Auth
                ◀─────── JWT ───────
                
Browser ──Authorization: Bearer JWT──▶ FastAPI ──verify (jose)──▶ self
                                       │
                                       └─psycopg + user_id from JWT─▶ Supabase Postgres
                                                                     (RLS: auth.uid() = user_id)
```

Pipeline (unchanged from before):

```
VALSEA ingest → Refine (Gemini/OpenAI) → Dispatch → Parallel specialists → Merge → Integrity
                       ↑                                                              |
                       └────────────── retry (max 1) ──────────────────────────────┘
```

- **Safety:** NIH RxNav (DDI) + OpenFDA (indications) + user allergy cross-check — always `warn`, never block.
- **Citations:** Every insight requires `verbatim_citation` from the transcript.
- **Persistence:** Profiles + completed consultations live in Supabase; in-progress LangGraph state stays in memory.

## API endpoints

All `/me/*` and `/consultations/*` endpoints require `Authorization: Bearer <jwt>` (the SSE events endpoint accepts `?access_token=` instead, since browsers can't attach headers to `EventSource`).

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | Public health probe |
| GET  | `/me` | Current user's profile (404 if not yet created) |
| POST | `/me` | Upsert profile |
| POST | `/me/medications` | Append a medication |
| GET  | `/me/consultations` | Your consultation history |
| POST | `/consultations` | Start pipeline (multipart: `use_fixture`, `transcript_text`, `audio`) |
| GET  | `/consultations/{id}` | Poll state (403 if owned by someone else) |
| GET  | `/consultations/{id}/events` | SSE stream — pass `?access_token=<jwt>` |
| POST | `/consultations/{id}/acknowledge-warnings` | Dismiss warnings |

## Tests

```bash
cd backend
pytest
```

- `test_auth.py` runs the JWT round-trip without needing live Supabase.
- `test_user_profile.py` and `test_consultation_repo.py` skip unless `DATABASE_URL` points at real Supabase. They seed a minimal `auth.users` row to satisfy the foreign key, then clean it up.

## Operational notes

- **Pooler vs direct DB:** Always use the Transaction pooler (`:6543`). The direct `db.<ref>.supabase.co:5432` URL is IPv6-first, has no connection pooling, and adds 5-10 s of latency per request.
- **JWT secret rotation:** If `SUPABASE_JWT_SECRET` is ever leaked, rotate it in Supabase Dashboard → Project Settings → API → JWT Settings → Rotate, then update `backend/.env` and restart.
- **Email confirmation:** Re-enable for production; the demo flow assumes auto-login on signup.

## Stack

- **VALSEA** — transcription (fixture fallback)
- **LangGraph** — orchestration
- **Gemini or OpenAI** — refinement + agents (auto-detect via env keys; Gemini wins if both set)
- **RxNav + OpenFDA** — medical validation
- **Supabase Auth + Postgres** — accounts, JWT, persistence, RLS

## FigJam reference

[Buildathon proposed flow diagram](https://www.figma.com/board/QIbNvjnWmmWZDC5pOdzln6/Buildathon-proposed-flow-diagram)
