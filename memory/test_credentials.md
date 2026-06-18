# GhostWriter — Test Credentials & Runtime Notes

## Test account (Neon prod DB)
- Email: demo@ghostwriter.app
- Password: Demo12345!
- (Older `test@ghostwriter.app` was created in a now-wiped local DB — not valid.)

## Runtime architecture (IMPORTANT for this environment)
- App is **Next.js 16** (full-stack) living at `/app` root.
- `frontend` supervisor program → `/app/frontend/start.sh` → runs `next start` on **port 3000** (production build; dev mode's HMR websocket is 502'd by the ingress and stalls hydration, so we run production).
- `backend` supervisor program → `/app/backend/server.py` = **FastAPI reverse proxy on 8001** that forwards `/api/*` → `http://127.0.0.1:3000/api/*` (ingress sends `/api/*` to 8001; pages/_next go to 3000).
- DB: **Neon serverless Postgres** (cloud) via `DATABASE_URL` in `/app/.env`. `db/index.ts` is driver-aware (`USE_LOCAL_PG=true` → node-postgres; otherwise Neon HTTP). Here we use Neon (no USE_LOCAL_PG).
- After ANY code change you MUST rebuild: `cd /app && npm run build` then `sudo supervisorctl restart frontend`.

## Env
- `/app/.env` holds the user's real secrets (Neon URL, Anthropic key, etc.). NEXTAUTH_URL + NEXT_PUBLIC_APP_URL forced to the preview URL.
- Google OAuth (GOOGLE_CLIENT_ID/SECRET) came through EMPTY — Google login not yet wired; email/password works.
- Sentry gated behind NEXT_PUBLIC_SENTRY_DSN (no-op without it).
