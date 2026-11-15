# AI_ARCHITECTURE — analisi dell'esistente e architettura proposta

Stato: **Fase 1 (analisi) completata; la proposta non è ancora implementata** salvo dove indicato. Per le regole: `GAME_RULES.md` (fa fede il codice di `engine.ts`).

## 1. Architettura attuale
| Elemento | File | Note |
|---|---|---|
| Regole | `packages/game-engine/src/engine.ts` | Funzioni pure su `GameState` serializzabile, PRNG deterministico (`rng.ts`), `tallyMarks`, `scoreTurn`. |
| Vista giocatore | `views.ts` (`viewFor`) | Unico output verso i client. |
| Bot | `ai.ts` (`chooseBotAction`, `planMiniVote`), `botstyle.ts` (12 «caratteri»), `bot.ts` (azioni a caso), `tags.ts` (etichette nascoste) | Una funzione pura per decisione. |
| Esecuzione | `worker/src/RoomCore.ts` | I bot decidono **sul server** (Durable Object), un'azione a testa dopo un ritardo. `botMem` salvata nello stato stanza. |
| Test | `ai.test.ts`, `fairplay.test.ts`, `botStyle.test.ts`, `miniBots.test.ts`, `taratura.test.ts` (a mano) | |
| Misure | `tools/analysis/bot-*.ts` | Script, non un laboratorio. |

Flusso di una partita: PROCLAIM (Megafono sceglie la frase) → PLAY (tutti giocano una carta) → SUSPECT (il Megafono posa un segnalino) → VOTE (tutti votano) → RESULTS; intervalli a tempo (MINI_RUN) a metà partita.

### Come decide oggi un bot
- Stima P(gruppo vota la posizione *i*) = softmax dell'affinità etichetta carta↔frase (temperatura per livello) mescolata con la storia delle carte cadute.
- Campiona 36 voti simulati per gli altri e sceglie azione (posizione × segnalino × proprio voto) per **valore atteso del turno** (`m − f`: vantaggio sulla media della Folla), con rumore softmax.
- Livello = probabilità di svista + rumore + «profondità» nel leggere i bluff. Carattere = 6 tratti (fiducia, gregarietà, bluff, sospetto, rischio, rapidità).
- Memoria: una sola per stanza (`BotMemory`: volte mostrata / caduta per carta). **Nessun modello per giocatore**, nessuna memoria tra partite.

## 2. Limiti
1. **Un solo passo**: nessuna valutazione di classifica o probabilità di vittoria; il punteggio del turno è l'obiettivo.
2. **Nessun opponent model**: tratta tutti gli avversari come «il gruppo» definito dalle etichette.
3. **Livelli poco distinti** (differiscono per rumore/svista, non per ragionamento): Medio ≈ Difficile secondo `BOTS.md` (da verificare).
4. **Fair play per convenzione**: `chooseBotAction` riceve il `GameState` completo; solo `fairplay.test.ts` impedisce di leggere dati nascosti. Proposta: tipo `Observation` costruito da `viewFor`, così il dato nascosto non è proprio accessibile.
5. **Punteggio duplicato** in `ai.ts` (risolto in Fase 1: ora passa da `scoreTurn`).
6. **Tetto CPU** (10 ms/richiesta nel piano gratuito, da ri-verificare) per qualunque ricerca nel Worker.
7. **Tetto di percezione**: la qualità dipende dalle etichette; senza dati umani non si sa quanto siano fedeli.

## 3. Da riutilizzare / sostituire
- **Riutilizzare**: motore, PRNG, `simulateGame`, `tallyMarks`, `scoreTurn`, `viewFor`, `tags.ts`, caratteri, `fairplay.test.ts`, `planMiniVote`.
- **Sostituire/estendere**: valutazione a un passo, memoria, selezione del livello; aggiungere `Observation`.

## 4. Rischi di regressione
Tocca la funzione più sensibile del gioco online (decisioni dei bot in stanza). Mitigazioni: Baseline AI congelata e testata (impronta SHA-256), test di identità delle decisioni, registro versioni con predefinito esplicito, benchmark con IC prima di cambiare il predefinito, test di fair play su ogni motore.

## 5. Fase 1: ciò che esiste ora
- `src/ai-baseline/ai.ts`: **Baseline AI v1**, copia fedele del codice al commit `6e2f4b1` (tag Git `baseline-ai-v1`), solo i percorsi di import cambiati. Il test verifica l'impronta SHA-256 del file.
- `src/bot-engines.ts`: registro `BOT_ENGINES` (`baseline-1`, `legacy-1.1`), `DEFAULT_BOT_ENGINE = "legacy-1.1"`, `getBotEngine(id)`. **Non ancora collegato a `RoomCore`** (il Worker usa ancora `chooseBotAction` direttamente: nessun cambiamento in produzione).
- `engine.ts` → `scoreTurn`: unica funzione dei punti di un turno, usata da `resolve()` e dai bot.
- `tools/analysis/engine-compare.ts`: confronto testa a testa tra versioni con IC.
- Regola: un motore nuovo diventa predefinito solo dopo benchmark e regressioni verdi (`AI_BENCHMARKS.md`).

## 6. Architettura proposta (da implementare)
Pacchetti: `packages/strategic-ai` (motore), `packages/ai-lab` (simulatore, tornei, benchmark, esportazione), pannello nella web app (come `/intervalli`, protetto da `?debug`).

| Modulo | Compito | Base teorica |
|---|---|---|
| Game State Analyzer | Da `Observation` → caratteristiche (classifica, distanza dal primo, turni residui, carte viste) | — |
| Strategic Evaluator | Utilità = probabilità di vittoria (rollout) + termini di rango | S1 |
| Opponent Model | Posteriori per giocatore (Beta/Dirichlet, decadimento, riduzione al prior) | S2 |
| Opponent Prediction | Distribuzione su voti, bersagli, segnalino; dipendenze (convergenza sulla stessa carta) | S2, S5 |
| Simulation | Rollout Monte Carlo, mondi campionati, regret matching per la matrice segnalino×voto, budget in ms con ripiego | S1, S5, S6 |
| Ability Evaluator | Segnalini CADE/NON CADE/VOTI NULLI!: valore, bluff, quando conviene | S6 |
| Adaptive Strategy | Aggiorna rischio e bersagli in base ai dati osservati | S2 |
| Difficulty Manager | Facile = livello 0 + rumore; Medio = best response al gruppo; Difficile = best response ai modelli appresi | S3, S4 |
| Personality Manager | 7 profili (aggressivo, opportunista, conservativo, competitivo, imprevedibile, strategico, imitatore) come funzioni di utilità/priori, non coefficienti casuali | — |
| Bot Memory | Partita corrente / per avversario / statistiche; azzerabile | S2 |
| AI Laboratory / Benchmark | Tornei, popolazioni, IC, esportazione CSV/JSON, confronto versioni | S7 |

Interfaccia comune: `BotEngine` (già in `bot-engines.ts`), con `chooseAction(Observation|GameState, …)` e budget di tempo. Ogni versione ha id, data, configurazione, risultati e regressioni in `AI_CHANGELOG.md`.

## 7. Piano
1. Fase 1 (fatta): analisi, baseline, punteggio unico, ricerca. 
2. Fase 2: `Observation`, test di fair play per tipo; interfaccia `BotEngine` v2; collegamento facoltativo a `RoomCore` per versione.
3. Fase 3: laboratorio **minimo** (tornei, IC, CSV/JSON) — serve per misurare tutto il resto.
4. Fasi 4–7: Opponent Model → Prediction → rollout/vittoria → livelli e personalità → memoria; ogni componente misurato da solo.
5. Fasi 8–10: pannello del laboratorio, benchmark completi (≥ 1.000 partite per confronto), ottimizzazione e integrazione, `AI_PERFORMANCE.md`.
