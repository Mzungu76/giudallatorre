# AI_ROLLBACK — come tornare indietro

Garanzia: i bot e il codice del gioco com'erano **prima** del collegamento del motore strategico sono conservati e ripristinabili in qualsiasi momento, in tre modi di forza crescente.

## Cosa è stato conservato
- **Ramo di backup** sul repository: `backup/main-6e2f4b1-prima-dei-bot-strategici` = `main` al commit `6e2f4b1`, cioè il gioco come era prima di tutto il lavoro sui bot. Non si modifica.
- **Baseline AI v1**: i bot originali sono anche copiati in `packages/game-engine/src/ai-baseline/ai.ts`, con impronta controllata da test, e `ai.ts`, `bot.ts`, `botstyle.ts`, `engine.ts` non sono mai stati modificati (test `protectedFiles.test.ts`).
- **Il collegamento è un commit isolato** («Bot strategici sperimentali nelle stanze di collaudo»): contiene tutte e sole le modifiche a Worker, protocollo e app web. Il suo identificativo è nel registro Git (`git log --oneline -- worker/src/strategicBots.ts`).

## Come funziona il collegamento (cosa può toccare)
Il motore strategico si attiva **solo** in una stanza creata da `/crea?debug=bot&motore=strategico`. Senza quel parametro (cioè per ogni giocatore normale) il codice nuovo non viene mai eseguito: i bot sono `chooseBotAction`, come prima. Tre test lo verificano (nessuna opzione, collaudo senza opzione, opzione senza `debug`).

## Come tornare indietro
1. **Spegnere subito (una riga)**: in `worker/src/strategicBots.ts` mettere `STRATEGIC_BOTS_ENABLED = false` e pubblicare. L'opzione viene ignorata; nessuna stanza può più usare il motore nuovo.
2. **Annullare il collegamento (un comando)**: `git revert <commit del collegamento>`. È stato verificato che l'annullamento riporta Worker, protocollo e app web **identici** a prima (stessi file, byte per byte), vedi sotto.
3. **Tornare allo stato originale completo**: `git checkout backup/main-6e2f4b1-prima-dei-bot-strategici -- .` (oppure ripubblicare quel ramo). Riporta tutto il repository, documenti e pacchetti nuovi compresi, a com'era.

## Verifica fatta
Annullando il commit del collegamento in una copia di prova, i file `worker/src/RoomCore.ts`, `packages/game-protocol/src/index.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/screens/Forms.tsx` risultano uguali a quelli prima del collegamento; `RoomCore.ts` e `Forms.tsx` sono uguali a `main` salvo le modifiche delle PR già fuse nel frattempo (nessuna al momento).
