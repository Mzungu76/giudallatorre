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
**Migrati** (586 testi): tutto ciò che il giocatore legge nell'app: tutorial e schede del Megafono, menu Aiuto e fumetti, regolamento, schermate di gioco (frase, mano, Lui!, voto, riepilogo punti, classifica, finale), spoglio e narrazione, mini-giochi, lobby/crea/entra, chat, schermo condiviso, nomi e frasi dei personaggi, messaggi di errore, scritte buffe della scena della caduta, condivisione e installazione.
**Non migrati** (restano nel codice):
- le **frasi del Megafono e le confessioni** (`content/*.json`): sono dati del server, non si aggiornano con questo meccanismo;
- i **nomi dei bot** e la parola «ammette» delle confessioni, composti dal server (`worker/`, `packages/game-engine`);
- titolo e descrizione della pagina (`index.html`, manifest) e le schermate di prova `StandingsDemo`;
- i testi dentro le immagini/SVG disegnati nel codice (`scene/draw.ts`).

Ogni file migrato è elencato in `PULITI` nel test: lì un testo scritto a mano fa fallire `npm test`.
