#!/usr/bin/env bash
# Costruisce il frontend, avvia il Worker in locale e fa giocare una partita vera a 3 browser.
set -euo pipefail
npm run build >/dev/null
npx wrangler dev --port 8787 --local > /tmp/wrangler-ui.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; pkill -f workerd 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://127.0.0.1:8787/api/health >/dev/null && break; sleep 1; done
node scripts/e2e-ui.mjs
