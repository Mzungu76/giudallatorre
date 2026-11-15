# AI_BENCHMARKS — misure e confronti

Metodo comune: `tools/analysis/engine-compare.ts`. Mazzo reale (120 personaggi, mazzo frasi per fascia d'età, etichette reali), intervallo (mini-gioco) attivo, partite complete. Metà dei posti gioca con la versione A, metà con la B, e i posti ruotano a ogni partita; i seed sono fissi (`1000 + k`), quindi **ripetibile**: `GAMES=2000 PLAYERS=4 LEVEL=hard A=baseline-1 B=production npx tsx tools/analysis/engine-compare.ts`. Il confronto fra versioni (`A`, `B`) usa gli id di `BOT_ENGINES`; `TUNE_A_<nome>=…` / `TUNE_B_<nome>=…` sovrascrivono un parametro della versione solo in quel processo. Gli intervalli di confidenza (IC 95%) sono calcolati sulla differenza per partita (A−B). Parità in testa divise tra i pari merito.

## 1. Stato dei test
- Inizio Fase 1: 261 test passati, 2 saltati (taratura manuale), typecheck pulito.
- Dopo la Fase 2: **281 passati**, 2 saltati; typecheck pulito; `npm run e2e` passa in locale; `npm run e2e:ui` 6 volte su 6 in locale. I bot in produzione e `engine.ts` sono identici all'originale (impronte controllate da `protectedFiles.test.ts`).
- Il test «Il bot difficile batte tre bot facili» stampa gli stessi numeri di sempre (45,7% di vittorie, 15,12 contro 11,44 punti).
- **CI della PR #35 (corsa del primo commit)**: fallito `e2e:ui` («classifica finale» non raggiunta in 240 s, a fronte dei 52 s normali). Lo stesso commit era passato nella corsa su `push`; riprodotto 0 volte su 6 in locale; nello storico delle ultime 30 corse è l'unico fallimento. Il test usa una scelta casuale dei voti e non coinvolge i bot né il punteggio. Valutazione: blocco intermittente del test UI, non causato da queste modifiche; la corsa del commit successivo lo conferma o lo smentisce (vedi PR).

## 2. Scoperta: il valore «corretto» del NON CADE peggiora i bot
`cncPoints` (valutazione ipotetica del Megafono) dà al NON CADE a segno **+1** invece di +2 (le regole e `resolve()` dicono +2). Per misurare l'effetto ho creato una variante *temporanea* con il punteggio preso dal motore e un parametro `noncadeEv` (peso del NON CADE) e l'ho confrontata con la baseline. **La variante è stata ritirata**: i bot in produzione restano intoccati; i numeri sotto restano come misura, riproducibile in laboratorio quando il motore nuovo avrà una variante equivalente.

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

Lettura: fra 0 e 0,5 non c'è differenza rilevabile; salendo verso 1 i bot peggiorano in modo netto. **Il valore storico non è dimostrato ottimale, ma il valore «giusto» sulle regole è peggiore.** Ipotesi non verificata: la stima della probabilità che il gruppo voti la carta segnata è troppo ottimista, e sottovalutare il NON CADE compensa l'errore; la causa vera va cercata con il laboratorio. Decisione: **nessun cambio ai bot in produzione** (variante ritirata, `ai.ts` intatto).

*(Nota di metodo: con motori identici la differenza A−B non è esattamente zero, perché i posti A e B sono giocatori diversi nello stesso tavolo; vale zero in media.)*

## 3. Costo di calcolo
Misura con `tsx` (sviluppo), 60 partite da 6 giocatori, Difficile, 5.432 decisioni, sulla variante temporanea (ritirata):

| Versione | ms per decisione (media) |
|---|---|
| bot in produzione (= baseline-1) | ≈ 1,4–1,6 |
| variante con punteggio da `scoreTurn` | ≈ 1,9–2,0 (prima dell'ottimizzazione 2,3–2,7) |

Indicazione per il motore nuovo: valutare i turni con `scoreTurn` (anche con `withLines = false`) costa ≈ +0,4 ms a decisione (circa ×1,3) rispetto al calcolo inline. Non è stata misurata la coda (decisione peggiore) né il costo nel runtime Worker: da fare in `AI_PERFORMANCE.md` (Fase 10). Il limite di 10 ms di CPU per richiesta (COSTS.md) va ri-verificato.

## 4. Ancora da misurare (Fase 4 in poi)
Facile/Medio/Difficile tra loro (BOTS.md afferma «Medio e Difficile si equivalgono tra bot»: **non verificato qui**), differenze per personalità, popolazione eterogenea, previsione dei voti, esposizione a strategie dominanti, e confronti con giocatori umani.
