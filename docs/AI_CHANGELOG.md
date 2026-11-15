# AI_CHANGELOG — versioni dei bot

Regole:
- **I bot in produzione (`ai.ts`, `bot.ts`, `botstyle.ts`) non si toccano** finché un motore nuovo non ha dimostrato, con benchmark e test di regressione, di essere migliore **e** il proprietario non decide il cambio. Se il motore nuovo non riesce, il comportamento in partita resta quello originale. Un test (`tests/protectedFiles.test.ts`) controlla l'impronta dei file.
- Ogni versione ha identificativo, data, configurazione, benchmark, regressioni e descrizione.

## baseline-1 — Baseline AI v1 (2026-11-15, congelata)
- Origine: commit `6e2f4b1`, tag Git `baseline-ai-v1` (il tag è solo locale: il push dei tag è stato rifiutato dal container; il commit di riferimento è `6e2f4b1`). File `packages/game-engine/src/ai-baseline/ai.ts`, impronta SHA-256 controllata da test; il corpo coincide con `ai.ts` (stesso codice, solo gli import cambiano).
- Configurazione: `TUNE` originale (copia indipendente).
- Risultati: riferimento di tutti i confronti (`AI_BENCHMARKS.md`).

## production — bot in produzione (predefinito, invariato)
- È `ai.ts` così com'era al commit `6e2f4b1`. Nessuna modifica in nessuna fase finora.
- Registro: `BOT_ENGINES["production"]`, `DEFAULT_BOT_ENGINE = "production"` (`packages/game-engine/src/bot-engines.ts`). Il Worker non usa il registro: chiama ancora `chooseBotAction` direttamente.

## Fase 1 — esperimento ritirato (legacy-1.1)
Nella prima stesura della Fase 1 avevo modificato `ai.ts` e `engine.ts` (punteggio dei bot spostato su `scoreTurn`, con peso del NON CADE regolabile). Il comportamento in partita era identico (test), ma per direttiva del proprietario i bot in produzione devono restare **intoccati**: **ripristinati i file originali**. Resta la misura (`AI_BENCHMARKS.md` §2): valutare il NON CADE al valore reale peggiora i bot. `scoreTurn` vive ora in un file nuovo (`scoring.ts`) usato solo dal motore nuovo; `engine.ts` non è modificato.

## Fase 2 — Observation e confine di fair play (2026-11-15)
- `packages/game-engine/src/observation.ts`: `Observation`, `observe(stato, giocatore)`, `legalActions(osservazione)`, `isLegal`. Additivo: nessun file esistente cambia salvo `index.ts` (solo export aggiunti).
- `packages/game-engine/src/scoring.ts`: `scoreTurn` (punteggio di turni ipotetici), con test di equivalenza con `resolve()` su centinaia di turni reali.
- `packages/strategic-ai/`: nuovo pacchetto con l'interfaccia `StrategicEngine`, un agente di riferimento «casuale tra le azioni legali» e il registro. **Non collegato alle stanze.**
- Test nuovi: osservazione senza informazioni nascoste (stessa alterazione di `fairplay.test.ts`), legalità, confine di import, impronte dei file protetti. 281 test passati.
- Regressioni: nessuna. Comportamento dei bot in partita: identico per costruzione (file non modificati).

## Fase 3 — AI Laboratory minimo (2026-11-15)
- Nuovo pacchetto `packages/ai-lab` (additivo; nessun file dei bot o del motore modificato): partite con mosse simultanee, tornei ripetibili da seme, formazioni fisse o a gruppo, parametri di taratura temporanei per versione, statistiche (media, IC 95%, differenze appaiate, Wilson, dimensione del campione), esportazione CSV/JSON con impronta dei risultati, riga di comando `npm run lab`.
- Test: 25 nuovi (ripetibilità, rotazione dei posti, simultaneità, confine osservazione, ripristino dei parametri, esportazione, statistica). Un test ha trovato e fatto correggere un difetto del laboratorio stesso (parametri non ripristinati se il torneo veniva rifiutato a metà).
- Prime misure (bot attuali, 1.000 partite per confronto): Difficile > Medio > Facile in modo netto (`AI_BENCHMARKS.md` §4); baseline e produzione alla pari.
- Regressioni: nessuna; bot in produzione intoccati.

## Fase 4 — Opponent Model e previsione dei voti (2026-11-15)
- `packages/strategic-ai/src/opponents/`: logit multinomiale con prior e stima MAP (`logit.ts`), tipi (λ, ε) con EM e posteriore bayesiano (`types.ts`), modello per giocatore, tipo di tavolo, previsione dei voti, della convergenza e della caduta (`model.ts`), prior della popolazione (`prior.ts`, `prior.fitted.json`). Solo codice nuovo: bot in produzione intoccati; nulla è collegato alle stanze.
- `packages/ai-lab`: raccolta dei turni conclusi, ri-riproduzione offline dei predittori, confronti appaiati, calibrazione della convergenza, stima del prior (`npm run lab -- predict-eval | fit-prior`); aggancio opzionale `onResults` in `playGame`.
- `game-engine/src/index.ts`: esportato `crowdProbs` (sola aggiunta, per confrontare il modello di folla dei bot attuali).
- Misure (`AI_BENCHMARKS.md` §5): il modello prevede il voto degli altri molto meglio del modello di folla dei bot attuali (5 giocatori: −1,358 contro −1,544 nats/voto, accuratezza 47,5% contro 32,7%); l'adattamento al singolo aggiunge un guadagno piccolo ma crescente col turno; convergenza ben calibrata. Limite: tavolo di soli Facili previsto peggio del caso.
- Test: 25 nuovi (331 totali). Un test di equivalenza ha rivelato una discrepanza (κ predefinito diverso tra valutazione offline e modello in partita), corretta nel test.
- Regressioni: nessuna.
