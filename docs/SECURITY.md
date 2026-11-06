# SICUREZZA

| Tema | Come è risolto | Dove / test |
|---|---|---|
| Il client non decide nulla | Il server applica azioni al motore e invia solo viste; punteggi, mani, voti, esiti e fasi sono del server | `packages/game-engine`, `RoomCore` |
| Impersonificazione | L'identità deriva dal **token** (128 bit, solo hash SHA-256 salvato, confronto a tempo costante). Il codice stanza da solo non basta; i messaggi non contengono `playerId` | `worker/tests/roomcore.test.ts`, `e2e.mjs` |
| Doppi voti / doppi invii | Il motore rifiuta (`ALREADY_DONE`) voti, carte e Lui! ripetuti | test del motore e della stanza |
| Dati privati | `viewFor`: mano propria, proprietari delle carte e voti nascosti fino ai risultati, tipo di Lui! solo al Megafono | `privacy.test.ts`, e2e |
| Messaggi malformati | zod *strict*, limite 2 KB, JSON non valido = chiusura; 10 messaggi invalidi = chiusura | `security.test.ts`, e2e |
| Abusi | 30 messaggi di raffica, 15/s per giocatore; limiti per IP su creazione (10/min), ingresso (30/min), info e WebSocket (60/min) | `GameRoom.ts`, `index.ts` |
| WebSocket cross-site | Si controlla l'header `Origin` (deve coincidere con l'host) | e2e |
| Dati personali | Solo nickname, in memoria della stanza; nessun account, nessun indirizzo IP salvato; stanza cancellata (`deleteAll`) dopo 20 min vuota in lobby, 6 h inattiva in partita, 30 min dopo la fine | `RoomCore.tick` |
| Segreti | Nessun segreto nel repository: le credenziali Cloudflare sono *GitHub Secrets* | `docs/DEPLOYMENT.md` |

Limiti noti: i limiti per IP sono in memoria dell'isolate (protezione di base); per un'eventuale ondata di abusi Cloudflare offre regole di rate limiting gratuite da attivare nel pannello. Le sonde su `/api/rooms/:code/info` creano un oggetto vuoto per ogni codice interrogato (costo trascurabile ma contato nelle richieste): mitigato dal limite per IP.
