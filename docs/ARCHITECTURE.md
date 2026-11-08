# ARCHITETTURA (proposta, verificata a costo zero)

- **Un solo Worker** (TypeScript) serve: asset statici (React+Vite build) via *Workers Static Assets* e endpoint `/api` + `/ws/:codice`.
- **Un Durable Object (SQLite) per stanza** (`GameRoom`), indirizzato dal codice partita; usa **WebSocket Hibernation** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`, `ctx.getWebSockets`, tag per giocatore) e `setWebSocketAutoResponse` per ping gratuiti.
- Stato: tabelle SQLite (`players`, `hands`, `table`, `votes`, `scores`, `meta`); il motore puro (`packages/game-engine`) è una FSM deterministica senza I/O, riusata da Worker e test.
- Sessione: `playerId` + token casuale 128 bit (salvato come hash SHA-256); nessun account.
- Timeout/pulizia: `alarm()` del DO per inattività e cancellazione (`deleteAll()`) delle stanze finite/abbandonate.
- Segretezza: il server invia a ciascun client solo la sua vista (mano propria; carte in Torre senza proprietario; voti nascosti fino alla rivelazione).
- Rate limit: contatore per connessione nel DO (niente servizi esterni).
- Deploy: GitHub Actions → `wrangler deploy` con `CLOUDFLARE_API_TOKEN` come *secret* GitHub (da creare dall'utente); test prima del deploy.
- Alternativa scartata: Pages+Functions (meno adatto ai DO), D1/KV (non necessari).
- Contenuti: `content/frasi-megafono.json` + `content/confessioni.json` (riserva di frasi con famiglia ed età, `docs/FRASI_MEGAFONO.md`; le v4 sono in `content/storico/`) + `public/cards/manifest.json` (id `pNN-iNN`). Il mazzo di una stanza lo costruisce `buildPhraseDeck` (`packages/game-engine/src/phrases.ts`) all'avvio.
- Playwright è gratuito (open source) e già disponibile in questo ambiente.

## Implementazione Fase 4
- `packages/game-engine`: regole (pure, senza rete). `packages/game-protocol`: schemi zod e tipi dei messaggi (vedi `docs/PROTOCOL.md`).
- `worker/src/RoomCore.ts`: logica di stanza **indipendente dal runtime** (lobby, sessioni, host, espulsione, timer, pulizia, viste) → testabile con Vitest.
- `worker/src/GameRoom.ts`: Durable Object che collega RoomCore a SQLite (tabella `kv`, una riga `room` in JSON), WebSocket Hibernation (`acceptWebSocket`, `serializeAttachment`, auto-risposta al ping) e allarmi (timer di fase, passaggio host, pulizia, `hello` scaduto).
- `worker/src/index.ts`: routing HTTP/WS, validazione, limiti per IP, controllo `Origin`.
- Persistenza: lo stato completo è JSON; dopo un riavvio la stanza si ricostruisce da SQLite (verificato con `scripts/persist-check.mjs`).
