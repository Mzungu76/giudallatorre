# AI_ROLLBACK — come tornare indietro (bot v2 sperimentali)

- `main` non contiene la v2 finché non la unisci: tornare indietro = non unire la PR o chiuderla.
- La v2 è attiva **solo** in una stanza creata da `/crea?debug=bot&motore=v2`. Per ogni altra stanza il codice nuovo non viene eseguito (test `botV2.test.ts`).
- **Interruttore**: `V2_BOTS_ENABLED = false` in `worker/src/RoomCore.ts` fa ignorare l'opzione.
- **Annullare il collegamento**: `git revert` del commit «Bot v2 sperimentali nelle stanze di collaudo» (isolato: tocca solo Worker, protocollo e form di creazione).
- **Backup**: ramo `backup/main-6e2f4b1-prima-dei-bot-strategici` = `main` prima di tutto il lavoro sui bot.


## Etichette v2 e opzione `v2e`
`botEngine: "v2e"` (solo con `debug`) usa il bot v2 con le etichette v2. Spegnimento: `V2_BOTS_ENABLED = false` in `worker/src/RoomCore.ts` (ignora `v2` e `v2e`). Le etichette v2 sono dati in `content/etichette/` e non toccano `ai.ts` né `tags.ts`.

## Bot nuovi di default (v2e) — rollback
Dal commit «Bot nuovi di default» le **stanze create da ora** usano i bot v2 con le etichette v2 (`botEngine: "v2e"`). Le stanze già create non cambiano motore a metà partita.
- **Tornare ai bot di sempre per le nuove stanze**: `NEW_BOTS_DEFAULT = false` in `worker/src/RoomCore.ts` (una riga) e pubblicare; oppure `V2_BOTS_ENABLED = false` per ignorare qualsiasi opzione.
- **Confronto in collaudo**: `/crea?debug=bot&motore=attuali` (bot di sempre), `&motore=v2` (v2, etichette vecchie), `&motore=v2e` (nuovi).
- **Ripristino completo del codice**: `git revert` del commit «Bot nuovi di default»; `ai.ts`, `bot.ts`, `botstyle.ts`, `tags.ts` non sono stati toccati (test di impronta `protectedFiles.test.ts`).
- Le etichette v2 sono dati (`content/etichette/`): si correggono con `tools/etichette/applica.py` senza toccare il codice.

## Anteprima con i bot v2o
La copia di anteprima (`.github/workflows/anteprima.yml`) passa `--var BOT_ENGINE_DEFAULT:v2o`: le sue stanze normali usano v2o. Il gioco vero non ha la variabile e resta su v2e. Per tornare a v2e nell'anteprima basta togliere `--var …` dal workflow.
