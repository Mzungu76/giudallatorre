#!/usr/bin/env bash
# Prova di carico: avvia il Worker in locale, campiona CPU e memoria di workerd, esegue scripts/carico.mjs per ogni livello e riassume.
# Uso: bash scripts/run-carico.sh "flash:20 flash:60 normal:15"   (modo:stanze)
set -uo pipefail
LIVELLI=${1:-"flash:20"}
npm run build >/dev/null 2>&1
npx wrangler dev --port 8787 --local > /tmp/wrangler-carico.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; pkill -f workerd 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://127.0.0.1:8787/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:8787/api/health >/dev/null || { echo "Il Worker non si è avviato"; tail -30 /tmp/wrangler-carico.log; exit 1; }
for L in $LIVELLI; do
  MODO=${L%%:*}; N=${L##*:}; : > /tmp/campioni.txt
  ( while true; do ps -C workerd -o %cpu=,rss= 2>/dev/null | awk '{c+=$1; r+=$2} END {print c, r}' >> /tmp/campioni.txt; sleep 1; done ) &
  CAMP=$!
  MODE=$MODO ROOMS=$N node scripts/carico.mjs
  kill $CAMP 2>/dev/null
  awk '{ if ($1>m) m=$1; if ($2>r) r=$2; s+=$1; n++ } END { printf "workerd: CPU max %.0f%% media %.0f%% (di un core), memoria max %.0f MB\n", m, (n?s/n:0), r/1024 }' /tmp/campioni.txt
  sleep 3
done
