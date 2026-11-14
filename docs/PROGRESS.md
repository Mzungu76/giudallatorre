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

## Fase 5 — Frontend (completata in locale)
- [x] React + Vite + TypeScript (`apps/web`): Home, Crea, Entra (codice/QR/link), Lobby (QR, condivisione, host, espulsione, opzioni, timer), Megafono (frasi originali), scelta carta dalla mano (con ingrandimento), Torre con personaggi scontornati (5–8), Lui!, voto con ingrandimento, risultati animati (caduta, materassi, mani con oggetti diversi a ogni turno), punti, classifica finale (vittoria condivisa)
- [x] Scena animata portata dal prototipo approvato (`apps/web/src/scene/towerScene.ts`), suoni sintetizzati (silenziabili), `prefers-reduced-motion` rispettato, tasto "Salta"
- [x] Modalità tavolo e remota (stessa app; la modalità è un'opzione di stanza), **schermo condiviso** `/schermo/CODICE` di sola visione (il server non invia mai dati privati: testato)
- [x] Riconnessione automatica con backoff, banner di connessione, sessione nel browser (token), ritorno alla partita
- [x] PWA: manifest, icone (192/512/maskable), service worker per i soli contenuti statici (il gioco richiede Internet)
- [x] Prove su browser reali: `npm run e2e:ui` (3 telefoni + schermo condiviso, partita intera da 6 turni) e `scripts/e2e-ui8.mjs` (8 telefoni fino alla caduta, nono giocatore respinto)
- [ ] Da rifare a mano: scontorno delle 9 carte segnalate (`public/cutouts/review-needed.json`); per ora la carta intera

## Fase 6 — Grafica definitiva, giocatori virtuali, regole di equilibrio (in revisione)
- [x] Regole: malus −1 per il Lui! sbagliato, **Golden goal** se si finisce in parità in testa (tetto 30 turni extra), frase libera semplice (testo ≤ 80 caratteri oppure solo a voce)
- [x] **Giocatori virtuali** facile/medio/difficile (`docs/BOTS.md`), partita da solo, lobby con aggiunta/rimozione
- [x] Terrazza di carte, salita, spoglio con suspense, caduta su torre di profilo, classifica per turno e per giro, intermezzi, legenda "?", layout adattivo (`docs/DESIGN_SYSTEM.md`)
- [x] Prove: 116 test unit, `npm run e2e` (3 giocatori via WebSocket), `npm run e2e:ui` (3 browser + schermo condiviso), `scripts/e2e-ui8.mjs` (8 browser), `scripts/e2e-solo.mjs` (1 umano + bot, anche 7 bot a 360×640)
- [ ] Da provare a mano su telefoni veri (Doogee Blade Ultra, Redmi Note, Samsung più vecchio) con Chrome

## Fase 7 — Nuovo mazzo di frasi (bozza, in revisione)
- [x] Frasi riscritte con le regole dei test d'indagine (`docs/FRASI_MEGAFONO.md`): 405 frasi e 69 confessioni neutre rispetto al genere, con famiglia e fascia d'età
- [x] Opzioni di stanza **Pubblico** (6+/10+/14+/18+, predefinita 14+) e **Confessioni**; mazzo costruito all'avvio con 3 frasi di famiglie diverse e pesca pesata sulle fasce alte
- [x] Confessione mostrata a tutti con il nome del Megafono («Marco ammette…»)
- [x] Etichette dei bot per le nuove frasi; 165 test unit, `npm run e2e`, `npm run e2e:ui`
- [ ] Curatela delle frasi con l'autore (togliere, riscrivere, cambiare età) e prova a tavolo
- [x] Turni: 6 con 3 giocatori (2 giri), altrimenti un turno a testa (1 giro). Fuori programma: 1 fino a 5 giocatori, 2 da 6 a 8 (fuori programma diversi tra loro)
- [x] Uscita dalla partita: chi esce è sostituito da un bot se restano altri umani, altrimenti la stanza si chiude subito (`scripts/e2e-leave.mjs`)
- [x] Fuori programma «Il raccomandato» sostituito da **«Il peggiore»**: si gioca il personaggio peggiore in assoluto, si vota la carta da buttare giù (non la propria), ognuno prende un punto per ogni voto ricevuto dalla sua carta; nessun punto si perde
- [x] Spoglio dell'fuori programma identico a quello dei turni (voti uno alla volta, «Avanti ›» / «Salta ›»)
- [x] Mano rinnovata all'fuori programma: animazione «Rinnoviamo la tua mano!» (dal vuoto, mazzetto coperto, ventaglio, carte scoperte) quando si apre la scelta della carta
- [x] Aiuto ai giocatori (`docs/AIUTO_GIOCATORI.md`): 3 schermate iniziali, scheda «Sei il Megafono!», ruolo sempre visibile, fumetti solo se si resta fermi, esempi dei punti con carte vere, riga «Tu» nel riepilogo
- [x] Corretto il gettone Lui! che non si vedeva nella scheda «Il Lui!» del regolamento
- [x] Menu «i» → Aiuto (cosa devo fare adesso con freccia, tutorial, regolamento); «Questo turno non giochi carte» che resta finché lo tocchi; icona dei punti accanto ai numeri; fuori programma senza tetto e con +2 fisso al posto del ×2; tolto il numero sotto il pulsante nello zoom

## Fase 8 — Premio della serata
- [x] Registro per turno nel motore e `pickAward` (un solo premio a partita, pesi, consolazione, bot esclusi) con test (`packages/game-engine/tests/awards.test.ts`)
- [x] Scena `AwardScene` prima della scalata finale, testi per fascia d'età in `public/testi.json`; mockup in `mockups/premio-serata.html`
- [ ] Taratura di soglie e pesi dopo qualche partita vera
- [ ] Stanze ricorrenti e statistiche per giocatore (passi successivi)
