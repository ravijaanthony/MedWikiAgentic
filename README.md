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
# Windows
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env
# macOS / Linux
# source .venv/bin/activate
# python3 -m pip install -e '.[dev]'
# cp .env.example .env
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
source .venv/bin/activate # macOS
pip install -e ".[dev]" # Windows
python3 -m pip install -e '.[dev]' # macOS
copy .env.example .env     # optional: set GEMINI_API_KEY and/or OPENAI_API_KEY
cp .env.example .env    # macOS
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

## Deployment (DigitalOcean Droplet)

Production runs on a single Droplet at **http://167.71.21.93** (nginx on port 80 proxies `/api/` to the backend). Images are built in GitHub Actions, pushed to GHCR, and pulled on the server — the Droplet does not build from source.

### GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|--------|
| `DROPLET_HOST` | `167.71.21.93` |
| `DROPLET_USER` | `root` (or your SSH user) |
| `DROPLET_SSH_KEY` | Full private key matching `authorized_keys` on the Droplet |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

Also enable **Settings** → **Actions** → **General** → Workflow permissions: **Read and write**.

Trigger: push to `main`, or **Actions** → **Deploy to DigitalOcean Droplet** → **Run workflow**.

### One-time Droplet setup (SSH as root)

```bash
mkdir -p /opt/medwiki/backend
nano /opt/medwiki/backend/.env   # copy from backend/.env.example; use real secrets
```

Required in `/opt/medwiki/backend/.env`:

- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (if HS256)
- `CORS_ORIGINS` must include the public origin, e.g. `http://167.71.21.93` (see `backend/.env.example`)
- Optional: `GEMINI_API_KEY` / `OPENAI_API_KEY`, `VALSEA_API_KEY`

Open firewall ports **22** (SSH) and **80** (HTTP).

After the first successful workflow run, verify:

- App: http://167.71.21.93
- Health: http://167.71.21.93/api/health

Files involved: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`.

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
- **Production Droplet:** http://167.71.21.93 — ensure `CORS_ORIGINS` on the server includes that origin; redeploy via push to `main`.

## Stack

- **VALSEA** — transcription (fixture fallback)
- **LangGraph** — orchestration
- **Gemini or OpenAI** — refinement + agents (auto-detect via env keys; Gemini wins if both set)
- **RxNav + OpenFDA** — medical validation
- **Supabase Auth + Postgres** — accounts, JWT, persistence, RLS

## FigJam reference

[Buildathon proposed flow diagram](https://www.figma.com/board/QIbNvjnWmmWZDC5pOdzln6/Buildathon-proposed-flow-diagram)
