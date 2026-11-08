# Promemoria per chi modifica l'app

## Testi dell'app → `public/testi.json`
I testi che i giocatori leggono nell'app vivono in **`public/testi.json`** (con codice di versione progressivo), non nel codice.
L'app li rilegge all'apertura e, se il file pubblicato ha una versione più alta, li aggiorna al volo. Il proprietario li modifica con `/testi.html`.

**Se la tua modifica aggiunge, cambia o cancella un testo visibile:**
1. usa `t("chiave")` (testo con segni **grassetto**, `__evidenziato__`, `~corsivo~`, `{variabili}`) o `ts("chiave")` (solo testo semplice: aria-label, title, placeholder) da `apps/web/src/lib/testi.ts`; niente stringhe italiane scritte nel codice nei file migrati;
2. aggiungi/rimuovi la voce in `public/testi.json` (`t` testo, `s` sezione, `n` nota facoltativa);
3. **aumenta `versione` di 1** e aggiorna `aggiornato` (altrimenti le app già aperte non vedono il cambio);
4. se migri un file nuovo, aggiungilo a `PULITI` in `apps/web/tests/testi.test.ts`;
5. `npm test` deve passare: controlla che ogni chiave usata esista, che nessuna sia orfana e che i segnaposto coincidano.

Dettagli e elenco di cosa non è ancora migrato: `docs/TESTI.md`.
Le frasi del Megafono (`content/*.json`) sono dati del server, separati: vedi `docs/FRASI_MEGAFONO.md`.
