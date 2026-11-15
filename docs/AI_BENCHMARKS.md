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

## 4. Prime misure con l'AI Laboratory (Fase 3): i livelli dei bot attuali
Metodo: `npm run lab` (vedi `AI_LABORATORY.md`), motore `production` (= bot attuali), 1.000 partite per confronto, seme 1000, mazzi ed etichette reali, mosse simultanee, intervallo attivo. Due posti per livello nello stesso tavolo, posti rimescolati. Confronto appaiato per partita, IC 95%.

| Confronto | Giocatori | Punti A−B | Quota vittorie A−B (pp) | Posizione A−B |
|---|---|---|---|---|
| Difficile − Medio | 4 | **+3,69 ± 0,32** | **+20,6 ± 2,8** | −0,75 ± 0,07 |
| Medio − Facile | 4 | **+2,03 ± 0,32** | **+11,3 ± 3,0** | −0,42 ± 0,07 |
| Difficile − Facile | 4 | **+6,38 ± 0,37** | **+29,7 ± 2,5** | −1,14 ± 0,06 |
| Difficile − Medio | 6 | **+6,98 ± 0,33** | **+22,3 ± 1,5** | −1,65 ± 0,08 |
| baseline-1 − production (stesso codice) | 4 | +0,09 ± 0,26 (nessuna differenza) | +1,8 ± 3,1 (nessuna) | −0,01 ± 0,07 |

Quote di vittoria assolute (4 giocatori, 2 contro 2): Difficile 35,3% contro Medio 14,7%; Medio 30,6% contro Facile 19,4%; Difficile 39,9% contro Facile 10,2%. Con 6 giocatori Difficile 27,8% contro Medio 5,5% (il caso sarebbe 16,7%).

Lettura:
- **I tre livelli sono distinti in modo misurabile** (bot contro bot). Questo **smentisce** la frase di `BOTS.md` «Medio e Difficile si equivalgono tra bot», scritta su una versione precedente della taratura: oggi la differenza Difficile−Medio è grande. `BOTS.md` non è stato modificato (è documentazione del prodotto: da aggiornare per decisione del proprietario).
- Il controllo A/A (stesso codice, due nomi) dà zero: il laboratorio non inventa differenze.
- Costo: ≈ 0,6–0,8 ms per decisione a 4 giocatori (Difficile 0,7–0,8 ms; Facile 0,2 ms), ≈ 1,0–1,3 ms a 6, misurati in sviluppo.
- **Limite di validità**: sono bot contro bot, con lo stesso modello di percezione (etichette): non dicono nulla sulla forza contro persone.
- Questi numeri sono la **base di riferimento** per i motori nuovi: un motore nuovo di livello Difficile dovrà batterli, con IC, in tutti e tre i confronti di formazione (contro `production:hard`, `production:medium`, popolazione mista).

## 5. Fase 4: previsione del voto degli avversari
Metodo: `npm run lab -- predict-eval` (vedi `AI_LABORATORY.md`). Si giocano partite con una popolazione di bot attuali (3 Difficili, 3 Medi, 3 Facili nel gruppo, caratteri a caso, estratti a ogni partita), si registrano i turni conclusi e li si ri-riproduce offline: per ogni osservatore e turno il predittore vede solo ciò che l'osservatore sapeva al voto e prevede i voti **degli altri**. Metrica: log-verosimiglianza media per voto (nats; più alta = meglio; il caso = ln(1/n)) e accuratezza. **Prior addestrato su partite diverse** (seme 31337, 1.500 partite) da quelle di prova (seme 424242); un test garantisce che la valutazione offline coincida con ciò che l'agente fa in partita.

| Scenario (partite) | Caso | Folla dei bot attuali (hard) | Prior di popolazione | **Modello (tipi + tavolo)** | Accuratezza | Modello − popolazione |
|---|---|---|---|---|---|---|
| 3 giocatori misti (800) | −1,099 | −1,184 | −0,969 | **−0,946** | 57,5% (caso 33,3%) | +0,0225 |
| 5 giocatori misti (800) | −1,609 | −1,544 | −1,375 | **−1,358** | 47,5% (caso 20%) | +0,0174 |
| 6 giocatori misti (800) | −1,792 | −1,717 | −1,547 | **−1,522** | 43,9% (caso 16,7%) | +0,0246 |
| 8 giocatori misti (300) | −2,079 | −2,006 | −1,820 | **−1,784** | 38,5% (caso 12,5%) | +0,0360 |
| 5 giocatori, tutti Difficili (800) | −1,609 | −1,293 | −0,973 | **−0,918** | 76,1% (caso 20%) | +0,0550 |
| 5 giocatori, tutti Facili (800) | −1,609 | −1,706 | −1,678 | **−1,649** | 26,3% (caso 20%) | +0,0293 |

(Tutte le differenze tra colonne sono «rilevabili», IC 95% ben lontano dallo zero; vedi i limiti sugli intervalli in `AI_ALGORITHMS.md` §8.)

Letture:
1. **Il grosso del guadagno viene dal modello di popolazione**: prevede il voto molto meglio del modello di folla che i bot attuali usano di nascosto (`crowdProbs`), che ignora il segnalino e tratta tutti allo stesso modo (5 giocatori: −1,375 contro −1,544; accuratezza 47,5% contro 32,7%). Il modello vecchio è addirittura peggiore del caso a 3 giocatori e con tavoli di soli Facili.
2. **L'adattamento al singolo giocatore vale di meno ma è reale e cresce col turno** (5 giocatori, modello − popolazione: turno 1 +0,001 non rilevabile, turno 2 +0,012, turno 3 +0,016, turno 4 +0,024, turno 5 +0,032). Con più giocatori ci sono più turni e più voti da cui imparare (8 giocatori: +0,054 all'ultimo turno).
3. **Confronto tra le modalità di adattamento** (5 giocatori misti, rispetto al solo prior): coefficienti liberi +0,0012; solo scala λ +0,0115; scala + coefficienti +0,0116; **tipi (λ, ε)** +0,0188; tipi + tavolo (κ=4) +0,0174. I coefficienti liberi imparano troppo poco da ≤ 7 voti; i tipi sono più efficienti. Il tipo di tavolo aiuta nei tavoli omogenei (tutti Difficili: tipi +0,044 → +0,055; tutti Facili +0,021 → +0,029) e costa poco nei misti (−0,001): κ = 4 è un compromesso.
4. **Per livello del votante** (5 giocatori misti, modello − popolazione): Facili +0,027, Difficili +0,036, Medi −0,011 (i Medi sono il centro del prior: l'adattamento aggiunge solo rumore).
5. **Dipendenze tra decisioni**: la convergenza prevista coincide con quella osservata (5 giocatori: P(≥ 2 altri sulla stessa carta) 89,7% prevista, 89,8% osservata; ≥ 3: 33,0% / 33,0%; ≥ 4: 6,3% / 6,2%; 8 giocatori: 99,4/99,4, 67,6/68,9, 31,3/31,5).
6. **Limite**: un tavolo di soli Facili resta previsto peggio del caso (−1,649 contro −1,609): vedi `AI_ALGORITHMS.md` §8.

Costo: `predictVotes` 0,4–2,2 ms (3–8 giocatori), `predictFall` ≈ 1 ms (400 campioni).

**Cosa NON dimostra**: né prestazioni migliori in partita (qui si misura solo la previsione, componente isolato), né nulla sulle persone. Il valore del modello si vedrà quando le sue previsioni guideranno le decisioni (Fasi 5–6) e si confronteranno con la base di riferimento di §4.

## 6. Ancora da misurare (Fase 5 in poi)
Differenze per personalità/carattere, popolazione eterogenea, precisione delle previsioni, sfruttabilità, strategie dominanti, e confronti con giocatori umani.
