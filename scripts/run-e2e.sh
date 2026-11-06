#!/usr/bin/env bash
# Avvia il Worker in locale (workerd + Durable Objects SQLite), esegue la prova end-to-end e lo spegne.
set -euo pipefail
npm run build >/dev/null
npx wrangler dev --port 8787 --local > /tmp/wrangler-e2e.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; pkill -f workerd 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://127.0.0.1:8787/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:8787/api/health >/dev/null || { echo "Il Worker non si è avviato:"; tail -40 /tmp/wrangler-e2e.log; exit 1; }
node scripts/e2e.mjs
