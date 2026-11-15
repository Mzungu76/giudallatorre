# AI_CHANGELOG — versioni dei bot

Regola: ogni versione ha identificativo, data, configurazione, benchmark, regressioni e descrizione. Il predefinito (`DEFAULT_BOT_ENGINE` in `packages/game-engine/src/bot-engines.ts`) cambia solo dopo benchmark e test di regressione.

## baseline-1 — Baseline AI v1 (2026-11-15, congelata)
- Origine: commit `6e2f4b1`, tag Git `baseline-ai-v1`. File `packages/game-engine/src/ai-baseline/ai.ts` (impronta SHA-256 controllata da test).
- Configurazione: `TUNE` originale (copia indipendente). Valuta il NON CADE come +1 nelle scelte del Megafono.
- Risultati: riferimento di tutti i confronti (`AI_BENCHMARKS.md`).
- Regressioni: —.

## legacy-1.1 — bot in produzione (2026-11-15, predefinito)
- Stessa logica di baseline-1; **decisioni identiche** (test di regressione su partite intere).
- Cambiamenti: il punteggio ipotetico passa da `scoreTurn` (unica fonte delle regole, `engine.ts`); il +1 storico del NON CADE è ora il parametro esplicito `TUNE.noncadeEv = 0.5`.
- Misure: portare `noncadeEv` a 1 (valore «giusto») peggiora i bot di 0,75 ± 0,19 punti/partita e 7,1 ± 2,2 pp di vittorie (4 giocatori, Difficile, 2.000 partite): non adottato.
- Costo: ≈ +0,4 ms per decisione (≈ ×1,3, ambiente di sviluppo).
- Regressioni: nessuna rilevata (273 test verdi, typecheck pulito).
