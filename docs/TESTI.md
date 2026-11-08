# I testi dell'app

## Come funziona
- Tutti i testi migrati stanno in **`public/testi.json`**: `{ "versione": N, "aggiornato": "AAAA-MM-GG", "testi": { "chiave": { "t": "testo", "s": "sezione", "n": "nota" } } }`.
- **`versione`** è il codice progressivo. All'apertura l'app scarica `/testi.json` (senza cache, max 1,2 s) e, se la versione è **maggiore** di quella che ha (inclusa o già salvata nel telefono), usa i testi nuovi e li ricorda. Se la rete manca usa quelli salvati/inclusi.
- Il service worker non mette mai in cache `/testi.json` e `/testi.html`.

## Modificare i testi (senza toccare il codice)
1. Apri **`/testi.html`** dell'app pubblicata (o aprilo da file e scegli `public/testi.json`).
2. Cerca e modifica: anteprima in tempo reale, errori in rosso (segni non chiusi, segnaposto `{x}` cambiati).
3. **Scarica testi.json**: esce già con `versione + 1` e data di oggi.
4. Sostituisci `public/testi.json` nel repo, commit, deploy. Alla prossima apertura i telefoni si aggiornano.

Segni: `**grassetto**`, `__evidenziato__`, `~corsivo~`, `{nome}` = valore del gioco (non toccarlo), invio = a capo.

## Promemoria per gli sviluppatori
Vedi `CLAUDE.md`. Il test `apps/web/tests/testi.test.ts` fa fallire `npm test` se: una chiave usata nel codice manca nel JSON, una chiave del JSON non è più usata, i segnaposto non coincidono, o in un file già migrato compare un testo italiano scritto a mano.
Cancellare un testo = togliere il suo uso nel codice **e** la voce nel JSON; aggiungerlo = voce nel JSON + `t("chiave")`; poi `versione + 1`.

## Copertura
Migrati: tutorial iniziale (3 schermate), scheda «Sei il Megafono!», avviso «non giochi carte», menu Aiuto, fumetti, testi dei 3 mini-giochi, esempi dei punti.
**Ancora nel codice** (da migrare a gruppi, stesso metodo): regolamento (`HowTo`), schermate di gioco (`Game`, `MiniGame`, `Terrace` con la narrazione, `PointsPanel`, `BUi`, `Standings`, `FinalScene`), stanza/lobby (`Room`, `Forms`, `Home`, `HomeTools`), messaggi (`api`, `useRoom`, `Chat`), nomi/descrizioni dei personaggi, `HandRenewal`, `CharIntro`.
Le **frasi del Megafono e le confessioni** sono dati del server (`content/*.json`): non si aggiornano con questo meccanismo.
