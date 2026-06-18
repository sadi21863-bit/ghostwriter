#!/bin/bash
# Frontend wrapper: ensures local Postgres is up, then runs the Next.js app
# (which lives at /app root) on port 3000. Supervisor manages this process.
set -e

export PGDATA=/var/lib/gwpg
PGBIN=/usr/lib/postgresql/15/bin

# Ensure local Postgres is running (idempotent)
if ! su postgres -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  echo "[start.sh] starting local Postgres..."
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p 5432' start" || true
  sleep 2
fi

cd /app
# Production server (no HMR websocket needed — the platform ingress doesn't
# upgrade websockets to port 3000, which stalls Turbopack dev hydration).
# Rebuild only when no build exists; use `npm run build` after code changes.
if [ ! -f /app/.next/BUILD_ID ]; then
  echo "[start.sh] no build found — building..."
  NODE_OPTIONS="--max-old-space-size=2560" node_modules/.bin/next build
fi
exec node_modules/.bin/next start -p 3000 -H 0.0.0.0
