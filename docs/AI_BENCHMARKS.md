# AI_BENCHMARKS — misure e confronti

Metodo comune: `tools/analysis/engine-compare.ts`. Mazzo reale (120 personaggi, mazzo frasi per fascia d'età, etichette reali), intervallo (mini-gioco) attivo, partite complete. Metà dei posti gioca con la versione A, metà con la B, e i posti ruotano a ogni partita; i seed sono fissi (`1000 + k`), quindi **ripetibile**: `GAMES=2000 PLAYERS=4 LEVEL=hard A=baseline-1 B=legacy-1.1 npx tsx tools/analysis/engine-compare.ts`. Gli intervalli di confidenza (IC 95%) sono calcolati sulla differenza per partita (A−B). Parità in testa divise tra i pari merito.

## 1. Stato dei test (Fase 1)
- Prima delle modifiche: 261 test passati, 2 saltati (taratura manuale), typecheck pulito.
- Dopo: 273 passati, 2 saltati; typecheck pulito. I test della Fase 1 sono in `packages/game-engine/tests/scoringSource.test.ts`.
- **Regressione di comportamento**: con i parametri predefiniti, `legacy-1.1` (bot in produzione) prende le *stesse* decisioni di `baseline-1` in partite intere da 3, 4, 5, 6 giocatori, con tutti e tre i livelli (test dedicato). Il test «Il bot difficile batte tre bot facili» stampa gli stessi numeri di prima (45,7% di vittorie, 15,12 contro 11,44 punti).

## 2. Scoperta: il valore «corretto» del NON CADE peggiora i bot
`cncPoints` (valutazione ipotetica del Megafono) dava al NON CADE a segno **+1** invece di +2 (le regole e `resolve()` dicono +2). Ho riportato il punteggio al motore (`scoreTurn`) e l'ho confrontato con la baseline.

**Baseline (A, valore storico) contro valore «corretto» 1,0 (B)**, livello Difficile, 2.000 partite:

| Giocatori | Punti A−B (IC 95%) | Quota vittorie A−B (pp, IC 95%) |
|---|---|---|
| 3 | +1,85 ± 0,26 | +11,9 ± 2,8 |
| 4 | +0,75 ± 0,19 | +7,1 ± 2,2 |
| 6 | +0,60 ± 0,20 | +2,0 ± 1,5 (non rilevabile) |
| 4, livello Medio | +0,33 ± 0,22 | +2,3 ± 2,2 (non rilevabile) |

**Scansione del parametro `TUNE.noncadeEv`** (peso del NON CADE; 0,5 = storico; 1 = regole), 4 giocatori, Difficile, 2.000 partite, differenza A−B con A = baseline:

| noncadeEv (B) | Punti A−B | Vittorie A−B (pp) |
|---|---|---|
| 0 | −0,13 ± 0,18 | −0,1 ± 2,2 |
| 0,25 | −0,09 ± 0,18 | +0,1 ± 2,2 |
| 0,5 | −0,01 ± 0,18 | +1,7 ± 2,2 |
| 0,75 | +0,21 ± 0,18 | +3,1 ± 2,2 |
| 1 | +0,75 ± 0,19 | +7,1 ± 2,2 |

Lettura: fra 0 e 0,5 non c'è differenza rilevabile; salendo verso 1 i bot peggiorano in modo netto. **Il valore storico non è dimostrato ottimale, ma il valore «giusto» sulle regole è peggiore.** Ipotesi non verificata: la stima della probabilità che il gruppo voti la carta segnata è troppo ottimista, e sottovalutare il NON CADE compensa l'errore; la causa vera va cercata con il laboratorio. Decisione: **parametro esplicito `TUNE.noncadeEv = 0.5`**, nessun cambio di comportamento in produzione.

*(Nota di metodo: con motori identici la differenza A−B non è esattamente zero, perché i posti A e B sono giocatori diversi nello stesso tavolo; vale zero in media.)*

## 3. Costo di calcolo
Misura con `tsx` (sviluppo), 60 partite da 6 giocatori, Difficile, 5.432 decisioni:

| Versione | ms per decisione (media) |
|---|---|
| baseline-1 | ≈ 1,4–1,6 |
| legacy-1.1 (con `scoreTurn`) | ≈ 1,9–2,0 (prima dell'ottimizzazione 2,3–2,7) |

Il passaggio dal motore costa ≈ +0,4 ms a decisione (circa ×1,3). Non è stata misurata la coda (decisione peggiore) né il costo nel runtime Worker: da fare in `AI_PERFORMANCE.md` (Fase 10). Il limite di 10 ms di CPU per richiesta (COSTS.md) va ri-verificato.

## 4. Ancora da misurare (Fase 4 in poi)
Facile/Medio/Difficile tra loro (BOTS.md afferma «Medio e Difficile si equivalgono tra bot»: **non verificato qui**), differenze per personalità, popolazione eterogenea, previsione dei voti, esposizione a strategie dominanti, e confronti con giocatori umani.
