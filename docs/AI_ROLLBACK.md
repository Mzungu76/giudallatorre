# AI_ROLLBACK — come tornare indietro (bot v2 sperimentali)

- `main` non contiene la v2 finché non la unisci: tornare indietro = non unire la PR o chiuderla.
- La v2 è attiva **solo** in una stanza creata da `/crea?debug=bot&motore=v2`. Per ogni altra stanza il codice nuovo non viene eseguito (test `botV2.test.ts`).
- **Interruttore**: `V2_BOTS_ENABLED = false` in `worker/src/RoomCore.ts` fa ignorare l'opzione.
- **Annullare il collegamento**: `git revert` del commit «Bot v2 sperimentali nelle stanze di collaudo» (isolato: tocca solo Worker, protocollo e form di creazione).
- **Backup**: ramo `backup/main-6e2f4b1-prima-dei-bot-strategici` = `main` prima di tutto il lavoro sui bot.


## Etichette v2 e opzione `v2e`
`botEngine: "v2e"` (solo con `debug`) usa il bot v2 con le etichette v2. Spegnimento: `V2_BOTS_ENABLED = false` in `worker/src/RoomCore.ts` (ignora `v2` e `v2e`). Le etichette v2 sono dati in `content/etichette/` e non toccano `ai.ts` né `tags.ts`.
