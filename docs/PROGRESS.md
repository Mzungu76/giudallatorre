# PROGRESS

## Fase 1 — Analisi (completata)
## Fase 2 — Mockup (stile pop applicato a tutte le schermate, in attesa di approvazione finale)
- [x] Analisi repository (4 file originali + README minimale)
- [x] Lettura regolamento **rev. 5.2l**
- [x] Regolamento definitivo = rev. 5.2l (confermato)
- [x] Analisi PDF carte: 14 pagine, 125 immagini estratte (320×480 px nativi), 124 uniche esatte
- [x] Analisi `Carte_frasi.docx`: 50 carte × 5 frasi = 250 frasi uniche, importate in `content/su-sulla-torre.json`
- [x] Ricerca tecnologica e limiti gratuiti (`COSTS.md`, `ARCHITECTURE.md`)
- [x] Bozza `GAME_RULES.md`, `GAME_FLOW.md`, `RULES_AMBIGUITIES.md`
- [x] Decisioni utente su B1–B8 (vedi RULES_AMBIGUITIES)
- [x] Importate 15 frasi singole (`content/su-sulla-torre-singola.json`)

## Prossimi passi
Fase 2 (mockup) dopo il via sul rapporto di Fase 1.

## Fase 3 — Motore di gioco (completata, in attesa di eventuali modifiche)
- [x] `packages/game-engine`: FSM (PROCLAIM, PLAY, SUSPECT, VOTE, RESULTS, GAME_OVER), punteggi, spareggio, variante "Megafono sa", rotazione, mazzi con rimescolamento
- [x] Viste per giocatore (nessun dato privato altrui), errori tipizzati, stato JSON + PRNG deterministico
- [x] 62 test Vitest: preparazione 3–8 giocatori, validazioni, esempio del regolamento, spareggi, Lui!, privacy, ripristino da JSON, azioni simultanee, mazzo minimo, partite simulate 3–8 giocatori (entrambe le varianti) con invarianti di conservazione carte, contenuti reali (125 carte, 50×5 + 15 frasi)
- [x] CI GitHub Actions (typecheck + test)
- Prossima: Fase 4 (backend Cloudflare Workers + Durable Objects + protocollo WebSocket)

## Fase 4 — Backend (completata in locale; deploy in attesa dei dati Cloudflare dell'utente)
- [x] Protocollo tipizzato con zod (`packages/game-protocol`), API HTTP e WebSocket
- [x] Durable Object per stanza con SQLite, WebSocket Hibernation, token di sessione (solo hash), riconnessione con snapshot, host con tolleranza di 60 s, espulsione, timer opzionali, pulizia stanze
- [x] Sicurezza: validazione strict, rate limit, controllo Origin, privacy delle viste (`docs/SECURITY.md`)
- [x] 98 test unit + prova end-to-end su workerd reale (partita completa da 3 giocatori via WebSocket, riconnessione, token errato, JSON non valido, Origin) + ripristino dopo riavvio
- [ ] Deploy su Cloudflare: richiede account e segreti dell'utente (`docs/DEPLOYMENT.md`)
