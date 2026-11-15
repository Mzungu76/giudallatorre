# AI_ARCHITECTURE — analisi dell'esistente e architettura proposta

Stato: **Fasi 1 (analisi, baseline) e 2 (osservazione e confine di fair play) completate; il motore strategico vero e proprio non è ancora implementato.** I bot in produzione non sono stati modificati. Per le regole: `GAME_RULES.md` (fa fede il codice di `engine.ts`).

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
5. **Punteggio duplicato** in `ai.ts` (`cncPoints` rifà il calcolo di `resolve()`, e dà al NON CADE +1 invece di +2). **Non corretto di proposito**: la correzione peggiora i bot (`AI_BENCHMARKS.md` §2) e i bot in produzione restano intoccati. Il motore nuovo userà `scoreTurn`.
6. **Tetto CPU** (10 ms/richiesta nel piano gratuito, da ri-verificare) per qualunque ricerca nel Worker.
7. **Tetto di percezione**: la qualità dipende dalle etichette; senza dati umani non si sa quanto siano fedeli.

## 3. Da riutilizzare / sostituire
- **Riutilizzare**: motore, PRNG, `simulateGame`, `tallyMarks`, `scoreTurn`, `viewFor`, `tags.ts`, caratteri, `fairplay.test.ts`, `planMiniVote`.
- **Sostituire/estendere**: valutazione a un passo, memoria, selezione del livello; aggiungere `Observation`.

## 4. Rischi di regressione
Tocca la funzione più sensibile del gioco online (decisioni dei bot in stanza). Mitigazioni: Baseline AI congelata e testata (impronta SHA-256), test di identità delle decisioni, registro versioni con predefinito esplicito, benchmark con IC prima di cambiare il predefinito, test di fair play su ogni motore.

## 5. Fase 1: ciò che esiste ora
- `src/ai-baseline/ai.ts`: **Baseline AI v1**, copia fedele del codice al commit `6e2f4b1` (tag Git `baseline-ai-v1`), solo i percorsi di import cambiati. Il test verifica l'impronta SHA-256 del file.
- `src/bot-engines.ts`: registro `BOT_ENGINES` (`baseline-1`, `production`), `DEFAULT_BOT_ENGINE = "production"`, `getBotEngine(id)`. **Non collegato a `RoomCore`** (il Worker usa ancora `chooseBotAction` direttamente).
- **I bot in produzione sono intoccati** (`ai.ts`, `bot.ts`, `botstyle.ts`, e anche `engine.ts`): impronte SHA-256 controllate da `tests/protectedFiles.test.ts`. Regola del proprietario: se il motore nuovo non riesce, il comportamento resta quello originale.
- `tools/analysis/engine-compare.ts`: confronto testa a testa tra versioni con IC.
- Regola: un motore nuovo diventa predefinito solo dopo benchmark, regressioni verdi e decisione esplicita del proprietario.

## 5b. Fase 2: confine di fair play
- **`Observation`** (`src/observation.ts`): ciò che un giocatore seduto al tavolo può sapere = ciò che riceve il client (`viewFor`) + la carta che ha giocato (`myCard`) + la storia pubblica dei turni conclusi (`history`). Non contiene mani altrui, carte coperte, voti segreti, proprietari prima dello spoglio, segnalino altrui, ordine dei mazzi né seme.
- **`legalActions(osservazione)`**: le azioni legali calcolate senza accesso allo stato; verificate contro il motore (ogni azione legale è accettata, ogni azione dei bot in produzione è legale).
- **`scoreTurn`** (`src/scoring.ts`): punti di turni *ipotetici*, necessari a un motore che simula. È una **seconda implementazione** dei punti di `resolve()`: `engine.ts` non si è toccato, quindi l'equivalenza è garantita da un test su centinaia di turni reali (`scoring.equivalence.test.ts`). Quando il motore nuovo verrà adottato, `resolve()` potrà usare `scoreTurn` (una sola fonte), con tutti i test.
- **`packages/strategic-ai`**: interfaccia `StrategicEngine` (`decide(memoria, osservazione, contesto)`), contesto con generatore casuale esterno e budget di tempo, agente di riferimento casuale. Il confine è imposto da un test: `src/` può importare da `@gdt/game-engine` solo nomi consentiti (mai lo stato completo né `applyAction`/`createGame`/`viewFor`).
- I test di fair play usano la stessa alterazione delle informazioni nascoste di `fairplay.test.ts` (`tests/hideFrom.ts`): `observe(alterato) == observe(reale)`, con controllo di efficacia.

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
1. Fase 1 (fatta): analisi, baseline, ricerca.
2. Fase 2 (fatta): `Observation`, `legalActions`, `scoreTurn`, interfaccia `StrategicEngine`, confine di fair play per tipo. **Nessun collegamento a `RoomCore`** finché non c'è un motore che superi i benchmark (Fase 10, su decisione del proprietario).
3. Fase 3: laboratorio **minimo** (tornei, IC, CSV/JSON) — serve per misurare tutto il resto.
4. Fasi 4–7: Opponent Model → Prediction → rollout/vittoria → livelli e personalità → memoria; ogni componente misurato da solo.
5. Fasi 8–10: pannello del laboratorio, benchmark completi (≥ 1.000 partite per confronto), ottimizzazione e integrazione, `AI_PERFORMANCE.md`.
