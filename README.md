# CookGuide (free-tier edition)

Type any dish, get a guided cooking session: ingredient checklist, serving scaler, one-step-at-a-time Cook Mode with timers, read-aloud, voice commands, screen wake lock, and an installable PWA.

**Stack:** React + Vite · FastAPI · SQLAlchemy (async) · PostgreSQL/SQLite · any OpenAI-compatible LLM API (Groq free plan by default) · Docker · Caddy

## How it works
1. `GET /api/recipes?name=` checks the database cache (no AI call, instant).
2. On a miss the frontend calls `POST /api/recipes`: the backend asks the LLM for structured JSON, validates it with Pydantic, stores it, and returns it. Each dish uses your free quota only once.
3. Generation is limited per IP, and your API key stays on the server.

## 1. Get a free API key
**Groq (default):** sign up at console.groq.com, create an API key. No card needed.
**Gemini (alternative):** create a key in Google AI Studio, then set in `backend/.env`:
```
LLM_BASE_URL=<Gemini's OpenAI-compatible endpoint, see Google's docs>
LLM_MODEL=<a free Flash model from your AI Studio dashboard>
```
Free limits change; check your provider's limits page.

## 2. Run locally (free)
```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env          # paste LLM_API_KEY, set JWT_SECRET
uvicorn app.main:app --reload
pytest                        # 6 tests

# frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```
Locally the app uses SQLite, so no database install is needed.

## 3a. Deploy for free (Vercel/Netlify + Render + free Postgres)
1. Push this folder to a GitHub repository.
2. **Database:** create a free Postgres at a provider of your choice (Neon and Supabase have free plans; check current limits). Do not rely on Render's free Postgres for long-term data, since it expires after about 30 days. Convert the connection string to start with `postgresql+asyncpg://`.
3. **Backend on Render:** New > Web Service > your repo > Root Directory `backend` > Runtime Docker > Free instance. Add environment variables:
   `ENVIRONMENT=prod`, `DATABASE_URL`, `JWT_SECRET` (long random text), `LLM_API_KEY`,
   `CORS_ORIGINS=["https://YOUR-FRONTEND-URL"]` (set after step 4, then redeploy).
   Free Render services sleep when idle, so the first request after a quiet period takes about a minute.
4. **Frontend on Vercel or Netlify:** import the repo, Root Directory `frontend`, build command `npm run build`, output `dist`. Add the environment variable `VITE_API_URL=https://YOUR-BACKEND.onrender.com`. Deploy, copy the frontend URL into the backend's `CORS_ORIGINS`, and redeploy the backend.
5. Open the frontend URL and test with `/api/health` on the backend URL first.

## 3b. Deploy on your own server (VPS + HTTPS)
```bash
cp .env.example .env          # fill POSTGRES_PASSWORD, LLM_API_KEY, JWT_SECRET, DOMAIN
docker compose up -d --build  # Caddy gets the HTTPS certificate automatically
```
Point your domain's A record at the server first. Ports 80 and 443 must be open.

## Production checklist
- [ ] Strong `JWT_SECRET` and database password; secrets never committed to git
- [ ] Replace `create_all` with Alembic migrations before changing the schema
- [ ] Redis storage for the rate limiter if you run more than one API instance
- [ ] PNG icons (192/512) in `frontend/public` and the manifest for best install support
- [ ] Monitor `/api/health`; back up the database
- [ ] Keep the on-page food-safety disclaimer: recipes are AI-generated

## API
| Method | Path | Notes |
|---|---|---|
| GET | `/api/recipes?name=` | cached recipe or 404 |
| POST | `/api/recipes` | get-or-generate, rate limited |
| GET | `/api/recipes/popular` | most searched dishes |
| POST | `/api/auth/register`, `/api/auth/login` | JWT |
| GET | `/api/favorites` | auth required |
| PUT/DELETE | `/api/favorites/{recipe_id}` | auth required |
| GET | `/api/health` | health check |
