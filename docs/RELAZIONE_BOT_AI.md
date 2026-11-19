# Giù dalla Torre — Relazione sui bot: bot attuali, bot sperimentali e conclusioni

Data: 2026-11-15 · Stato: progetto dei bot strategici **abbandonato**; restano in uso i bot attuali (invariati).
Il documento ha due livelli per ogni sezione: **«In parole semplici»** (per chi decide) e **«Report tecnico»** (per una valutazione esterna). I numeri sono riproducibili con gli strumenti indicati nell'Appendice.

---

# Parte 1 — I bot attuali (quelli in app)

## 1.1 In parole semplici
Il bot è un giocatore virtuale che riempie la stanza (da 3 a 6 giocatori in tutto). A ogni suo turno ragiona solo con ciò che vedrebbe una persona seduta al tavolo: la propria mano, le carte sulla Torre, la frase, dove è posato il segnalino, i risultati dei turni passati. Non vede le carte degli altri, né i voti segreti, né quale segnalino ha scelto il Megafono.

Come decide, in quattro mosse:
- **Frase (se è Megafono):** sceglie tra le frasi della carta quella che sa «leggere» meglio.
- **Carta da giocare:** gioca la carta che gli sembra più adatta alla frase, perché è quella che il gruppo voterà e, se cade, vale punti anche a lui.
- **Segnalino (se è Megafono):** prova mentalmente molte partite possibili («e se metto CADE su questa carta, quanti voteranno così?») e sceglie la mossa con il vantaggio atteso maggiore. Ogni tanto bluffa: sceglie il segnalino che gli altri leggerebbero peggio.
- **Voto:** stima su quale carta voterà il gruppo e vota di conseguenza, tenendo conto di cosa potrebbe aver messo il Megafono.

Per «capire» le carte e le frasi non legge il testo come una persona: usa etichette scritte a mano (tipo umano e temi, per 120 personaggi e 405 frasi) e, per le frasi inventate, un piccolo dizionario di parole-chiave. È buon senso approssimato, non comprensione.

**Tre livelli**, che cambiano la qualità del ragionamento:
- **Facile:** sceglie a caso 6 volte su 10, le altre ragiona da «medio» senza saper leggere i bluff.
- **Medio:** una svista su 5, legge i bluff a metà.
- **Difficile:** nessuna svista, legge i bluff fino in fondo.

**Dodici «caratteri»** (prudente, bluffatore, sospettoso, impulsivo…) estratti a caso a ogni partita cambiano *come* gioca (fiducia, gregarietà, voglia di bluffare, sospetto, rischio, rapidità), non *quanto* è bravo.

**Intervallo a tempo (mini-gioco):** i bot votano come una persona, guardando le carte man mano che escono, con un po' di incertezza e un tempo di reazione umano.

Quanto sono forti (misura nuova, bot contro bot, 1.000 partite per confronto): il Difficile batte nettamente il Medio, che batte nettamente il Facile (4 giocatori, Difficile contro Medio: 35% di vittorie contro 15%). **Non abbiamo misure contro persone.**

## 1.2 Report tecnico

### Architettura e dati
- Codice: `packages/game-engine/src/ai.ts` (≈200 righe, `chooseBotAction`), `botstyle.ts` (12 caratteri), `bot.ts` (azione casuale legale), `tags.ts` (etichette e lessico). Funzione pura `(stato, giocatore, livello, memoria, rand, carattere) → azione|null`.
- Esecuzione: lato server, nel Durable Object (`worker/src/RoomCore.ts`); un'azione a testa dopo un ritardo umano (0,9–2 s). Memoria `BotMemory` per stanza e per partita: solo informazioni pubbliche (volte che ogni carta è comparsa e caduta). Nessun modello per singolo giocatore, nessuna memoria tra partite.
- Informazioni: `chooseBotAction` riceve il `GameState` **completo**; il fair play è garantito per convenzione e da un test (`fairplay.test.ts`) che altera tutti i dati nascosti e verifica che nessuna decisione cambi (3–8 giocatori, tutti i livelli e le fasi, intervallo compreso).

### Decisione
Contesto di gioco: «Cade / Non cade». Per turno: il Megafono sceglie la frase, tutti giocano una carta in segreto, il Megafono posa un solo segnalino (CADE / NON CADE / VOTI NULLI!) su una carta, tutti votano in segreto. Punti: +2 a chi vota una carta caduta, +2 a chi l'ha giocata; CADE a segno +4 al Megafono e a ogni votante della Folla; NON CADE a segno +2 (idem); VOTI NULLI! annulla i voti su quella carta.
- **Stima del voto del gruppo (`crowdProbs`):** softmax dell'affinità etichette carta↔frase (temperatura 3; 1,6 per il Difficile), mescolata (85/15) con la frequenza storica di caduta per carta; senza etichette ripiega sulla sola storia.
- **Ricerca (un solo passo):** 36 voti simulati per gli altri (`propSample`); per ogni (posizione, tipo di segnalino) valore atteso = max sul proprio voto della media di (punti del Megafono − media punti della Folla), con punteggio `cncPoints`. Scelta finale softmax (temperatura per livello, modulata dal carattere).
- **Bluff / lettura del bluff:** il Megafono aggiunge un bonus `−log(credenza degli altri sul tipo)`; chi vota pesa i tre tipi possibili con una credenza `typeBelief` (softmax sui valori, `depth` e sospetto del carattere). `SKILL = {easy:0/0, medium:.5/.5, hard:1/1}`.
- **Livelli:** probabilità di svista (`easyLapse` 0,6, `mediumLapse` 0,2), rumore e profondità di lettura dei bluff (parametri in `TUNE`).
- **Intervallo:** `planMiniVote`: giudizio per carta con rumore, soglie diverse per giro, ritardo di reazione 0,65–2,75 s, qualche mancata risposta.
- **Costo:** misurato in sviluppo, ≈ 0,7–0,8 ms per decisione (Difficile, 4 giocatori), ≈ 1,0–1,3 ms a 6 giocatori, ≈ 0,2 ms il Facile.

### Peculiarità note
- **NON CADE valutato +1 invece di +2** nelle scelte del Megafono (`cncPoints`; il motore delle regole assegna +2; nel voto della Folla il valore è +2). Misurato: «correggere» il valore **peggiora** i bot di 0,75 ± 0,19 punti a partita e 7,1 ± 2,2 punti percentuali di vittorie (Difficile, 4 giocatori, 2.000 partite); valori 0–0,5 sono indistinguibili. Ipotesi (non verificata): compensa una stima ottimistica dei voti sulla carta segnata.
- `docs/BOTS.md` afferma che «Medio e Difficile si equivalgono tra bot»: la misura attuale lo **smentisce** (tabella sotto).

### Misure (AI Laboratory, motore `production`, mazzi ed etichette reali, mosse simultanee, 1.000 partite, confronto appaiato, IC 95%)
| Confronto (4 giocatori, 2 contro 2) | Punti A−B | Vittorie A−B |
|---|---|---|
| Difficile − Medio | +3,69 ± 0,32 | +20,6 ± 2,8 pp |
| Medio − Facile | +2,03 ± 0,32 | +11,3 ± 3,0 pp |
| Difficile − Facile | +6,38 ± 0,37 | +29,7 ± 2,5 pp |
| Difficile − Medio (6 giocatori) | +6,98 ± 0,33 | +22,3 ± 1,5 pp |
| Baseline v1 − produzione (stesso codice, controllo A/A) | +0,09 ± 0,26 | +1,8 ± 3,1 pp (nulla) |

### Limiti
Dipendenza dalle etichette scritte a mano; nessun modello dei singoli avversari; ricerca a un solo passo (nessuna valutazione di classifica o probabilità di vittoria); nessuna memoria tra partite; forza non misurata contro persone.

---

# Parte 2 — I bot sperimentali («Strategic AI Engine»)

## 2.1 In parole semplici
Abbiamo provato a costruire un bot di tipo diverso, che invece di seguire regole prepara ogni scelta così:
1. **Osserva** i comportamenti dei singoli avversari (come hanno votato nei turni passati) e impara che «tipo» di giocatore sono: quanto seguono il segnalino, quanto ragionano sulle frasi, quanto votano a caso.
2. **Prevede** come voterà ciascuno.
3. **Simula** il turno migliaia di volte con quelle previsioni e sceglie la mossa che rende di più.

Per fare questo abbiamo costruito anche un **laboratorio**: un programma che fa giocare i bot tra loro in migliaia di partite e dice, con margini di errore, quale vince. Prima di tutto abbiamo congelato una **copia dei bot attuali** per i confronti, e verificato che nessun bot nuovo possa usare informazioni nascoste.

Cosa è venuto fuori:
- Il **modello che prevede i voti funziona**: prevede il voto degli altri molto meglio del modo in cui i bot attuali stimano il gruppo (47–48% di voti azzeccati contro 32%, a caso sarebbe 20%), soprattutto perché i votanti seguono molto il segnalino posato, cosa che i bot attuali ignorano.
- Il **bot che usa quelle previsioni vinceva di più contro i bot attuali** nelle simulazioni (in una prima versione, fino a +21 punti percentuali di vittorie a 4 giocatori).
- **Ma giocato da una persona è risultato peggiore e meno divertente**: sceglieva quasi sempre CADE sulla propria carta, quasi mai NON CADE, votava il segnalino quasi sempre, non bluffava ed era prevedibile. I dati hanno confermato le tue osservazioni (sotto). Tradotto: aveva imparato a sfruttare i difetti dei bot attuali, non a giocare «bene» in senso umano.
- Quando abbiamo corretto il comportamento (bluff, meno voti sul segnalino), **è sparito gran parte del vantaggio**: a 4 giocatori quasi pari ai bot attuali, a 3 peggiore.
- Nei **mini-giochi** i bot nuovi usavano lo stesso comportamento dei bot attuali: nessuna strategia nuova.

Decisione presa: **abbandonare** i bot nuovi e tenere quelli attuali.

## 2.2 Report tecnico

### Componenti (codice nel ramo `ccr-2a3ea292-gtapcw`, PR #35 chiusa e non unita)
1. **Baseline congelata** (`ai-baseline/ai.ts`, tag Git `baseline-ai-v1` solo locale; riferimento commit `6e2f4b1`): copia dei bot attuali con impronta SHA-256 controllata da test; `ai.ts`, `bot.ts`, `botstyle.ts`, `engine.ts` mai modificati (test `protectedFiles.test.ts`).
2. **`Observation`** (`observation.ts`): input dei motori nuovi = vista del client + carta giocata + storia pubblica. Niente `GameState`. Test: l'osservazione non cambia se si alterano mani altrui, carte coperte, voti segreti, proprietari prima dello spoglio, segnalino altrui, mazzi, seme. `legalActions` calcolate dalla sola osservazione. `scoreTurn` (`scoring.ts`): punteggio di turni ipotetici, equivalente a `resolve()` per test su centinaia di turni reali.
3. **AI Laboratory** (`packages/ai-lab`): partite con **mosse simultanee** (tutti decidono dallo stesso stato), tornei ripetibili da seme, formazioni fisse o a gruppo, media con IC 95%, differenze appaiate per partita, Wilson, CSV/JSON con impronta dei risultati, CLI `npm run lab` (`tournament`, `predict-eval`, `fit-prior`).
4. **Opponent Model** (`strategic-ai/src/opponents`): logit multinomiale per la scelta del voto, con caratteristiche {affinità, «top-affinità», segnalino, propria carta, prima/ultima posizione}; prior di popolazione stimato dal laboratorio (1.500 partite dei bot attuali, 39.685 voti); **ragionamento per tipi** (Albrecht & Stone 2018) con risposta quantale (McKelvey & Palfrey 1995): tipo (λ nettezza, ε casualità, μ fiducia nel segnalino, α peso dell'affinità), `P(k) = ε/n + (1−ε)·softmax(λ·β'·x)`, distribuzione bayesiana sui tipi su griglia di 135, pesi a priori stimati con **EM**, **tipo di tavolo** (κ = 4: il prior di un giocatore include i posteriori degli altri avversari) e **quota uniforme 0,3** del prior (umiltà verso popolazioni mai viste). Carta del votante ignota: marginalizzata. Dipendenze tra voti: indipendenza data dagli indizi condivisi (verificata: convergenza prevista = osservata).
5. **Simulation Engine** (`sim/montecarlo.ts`): Monte Carlo con numeri casuali comuni, arresto anticipato (z = 3, ≥ 40 campioni), limite di tempo, scelta mista softmax; il turno è trattato come gioco a mosse simultanee (non albero sequenziale, cfr. Tak, Lanctot, Winands 2014).
6. **Bot** (`engines/strategic.ts`): per segnalino (posizione × tipo × proprio voto) e voto, valuta ogni candidato contro i voti previsti degli altri con `scoreTurn`. Obiettivo `points` (Megafono: vantaggio sulla media degli altri) o `win` (probabilità di vittoria ≈ Π Φ(distacco/σ)). Frase e carta da giocare: stessa euristica di affinità dei bot attuali. Intervallo: pianificatore dei bot attuali. Configurazioni: `strategic-max` (nessun bluff, credenza uniforme sul tipo, τ = 0,05), `strategic-pts` («vario»: bonus di bluff 1 sul tipo meno atteso con mix atteso 40/15/45, credenza sul tipo appresa dal tavolo, τ del segnalino 0,3), `strategic-win`.
7. **Collegamento sperimentale** (solo stanze `?debug=bot&motore=strategico[-max]`, spento di default, interruttore `STRATEGIC_BOTS_ENABLED`, ramo di backup `backup/main-6e2f4b1-prima-dei-bot-strategici`, procedura in `docs/AI_ROLLBACK.md`; annullamento verificato: albero identico).

### Risultati

**A. Previsione del voto degli altri** (log-verosimiglianza media per voto, nats; il caso a 5 giocatori = −1,609; prova su partite diverse da quelle di addestramento):
| Tavolo | Modello di folla dei bot attuali | Modello nuovo (finale) | Accuratezza nuovo (caso 20%) |
|---|---|---|---|
| 5 giocatori misti | −1,547 | ≈ −1,35 | ≈ 48% (contro 32%) |
| 5 giocatori, tutti Difficili | −1,294 | ≈ −0,91 | ≈ 76% |
| 5 giocatori, tutti Facili | −1,707 | ≈ −1,65 | ≈ 27% |
| 5 giocatori, tutti «scettici» (sintetico, ignora il segnalino) | −1,329 | −1,435 | ≈ 38% |
Il guadagno viene soprattutto dal modello di popolazione (il segnalino attira i voti: coefficiente 1,28 contro 0,15 dell'affinità). L'adattamento al singolo aggiunge poco ma cresce col turno (5 giocatori: turno 1 ≈ 0, turno 5 +0,03 nats). **Falsi esiti:** su un tavolo che ignora il segnalino il modello è **peggiore** del vecchio modello di folla (che su quel tavolo coincide con la verità per costruzione); un tavolo di soli Facili resta previsto peggio del caso. Costo 0,4–2,2 ms a previsione (prima dell'estensione dei tipi; ≈ ×3 dopo).

**B. Forza di gioco contro i bot attuali** (1.000 partite per confronto, semi non usati nella taratura, 2 nuovi contro 2 attuali salvo dove indicato; IC 95%):
| Configurazione e tavolo | Punti nuovo−attuale | Vittorie nuovo−attuale |
|---|---|---|
| *Prima versione* (prior stimato più stretto), 4 giocatori | +4,22 ± 0,29 | +21,5 ± 2,8 pp |
| *Prima versione*, 6 giocatori (3 contro 3) | +9,23 ± 0,34 | +23,5 ± 1,5 pp |
| *Prima versione*, 3 giocatori (1 contro 2) | +1,28 ± 0,34 | +7,3 ± 4,5 pp |
| `strategic-max` finale, 4 giocatori | +2,89 ± 0,29 | +14,4 ± 3,0 pp |
| `strategic-max` finale, 3 giocatori | +0,73 ± 0,33 | +4,0 ± 4,5 pp (n.s.) |
| `strategic-pts` («vario») finale, 4 giocatori | +0,92 ± 0,27 | +3,4 ± 3,1 pp (n.s.) |
| `strategic-pts` finale, 3 giocatori | **−1,58 ± 0,40** | **−9,7 ± 4,1 pp** |
| `strategic-pts` finale, 6 giocatori | +4,81 ± 0,29 | +16,3 ± 1,8 pp |
| `strategic-pts` finale, contro attuali Medi (4) | +4,36 ± 0,32 | +24,6 ± 2,7 pp |
Altre misure: con prior scritto a mano (non stimato sui bot) la prima versione vinceva comunque (+2,46 punti, +14,1 pp); la variante `win` batte i bot attuali ma non la variante `points` (testa a testa: −3,2 punti, −6,0 pp); contro un giocatore casuale e contro l'«scettico» sintetico il bot nuovo vince nettamente (ma sono avversari deboli: non informativi sulla forza contro persone). La **temperatura** della scelta mista è risultata decisiva (τ ≥ 0,8 → peggio dei bot attuali).

**C. Comportamento (che la misura delle vittorie non coglieva)**, 4 giocatori, bot nuovo (prima versione) contro bot attuali:
| | Bot nuovo | Bot attuale |
|---|---|---|
| Megafono: CADE / NON CADE / VOTI NULLI! | 87% / **0%** / 13% | 64% / 6% / 30% |
| Segnalino sulla propria carta | 87% | 45% |
| Folla: vota la carta col segnalino | **99,4%** | 73% |
Dopo l'introduzione del bluff e della credenza appresa: CADE ≈ 37–41%, NON CADE ≈ 23–32%, VOTI NULLI! ≈ 27–38%, ma la Folla vota il segnalino ancora il 94–99% delle volte; la variante «vario» perde forza (vedi B).

**D. Costo di calcolo:** bot nuovo ≈ 3,1–3,7 ms per decisione media (bot attuali 1,3–2,3 ms); picco misurato ≈ 28 ms per tick a 6 giocatori nel Durable Object in locale (limite CPU del piano gratuito, ≈ 10 ms per richiesta secondo `docs/COSTS.md`, da ri-verificare): rischio non risolto.

**E. Prova in anteprima con una persona** (proprietario): bot nuovi percepiti come meno performanti, prevedibili, poco inclini al bluff, mini-giochi senza strategia. Una sola persona, nessuna misura quantitativa: valore qualitativo ma coerente con C.

### Limiti metodologici
- **Bot contro bot, stesso modello di percezione.** Il bot nuovo usa le stesse etichette dei bot attuali e il modello è stato stimato sulle loro partite; i guadagni misurati sono in parte la capacità di **sfruttare** i comportamenti dei bot attuali (soprattutto il seguire il segnalino). Il prior «umile» e il prior scritto a mano riducono ma non eliminano il problema.
- **Avversari non adattivi**: la sfruttabilità del bot nuovo (un avversario che impara le sue abitudini) non è stata misurata.
- **Obiettivo mal specificato**: massimizzare i punti attesi/le vittorie contro bot non equivale a «giocare bene» contro persone né a produrre comportamento vario; un equilibrio degenere (marcare la propria carta CADE e votarla, con la Folla che segue) è risultato ottimale contro popolazioni che seguono il segnalino.
- **Parametri tarati su un seme**; le verifiche finali su semi disgiunti, ma il numero di prove complessivo (varianti, temperature, griglie) comporta un rischio di selezione. Gli IC delle previsioni trattano le osservazioni come indipendenti (stesso voto previsto da più osservatori): sono ottimisti.
- **Letteratura**: consultati autori, sedi, DOI e abstract; non i testi integrali (accesso diretto bloccato dall'ambiente). Le valutazioni di applicabilità sono quindi provvisorie.
- **Un incidente di CI** (test UI intermittente, `e2e:ui`, un fallimento su ~390 corse) non è stato riprodotto in 6 prove locali.

---

# Parte 3 — Conclusioni

## 3.1 In parole semplici
- **Decisione:** si tengono i bot attuali. I bot nuovi non vengono usati nel gioco.
- **Perché:** nelle simulazioni il bot nuovo non era *chiaramente* migliore dopo averne corretto il comportamento, ed era più lento e più complicato; nella prova umana è sembrato peggiore. Il vantaggio iniziale veniva dallo sfruttare le abitudini dei bot attuali, non dal giocare meglio.
- **Cosa resta di utile:**
  1. **Il laboratorio**: permette di misurare qualunque modifica futura ai bot con numeri e margini di errore, senza «sensazioni».
  2. **Una scoperta sui bot attuali:** sono già ben tarati. La piccola «stranezza» nel valore del NON CADE (+1 invece di +2) è in realtà un vantaggio: correggerla li peggiora.
  3. **I livelli attuali sono ben distinti** (Difficile > Medio > Facile), contro quanto scritto in `BOTS.md`.
  4. **Una lezione sul gioco:** il segnalino è il segnale principale che muove i voti. Chi lo segue vince punti; il bluff è ciò che rende il gioco interessante ed è proprio ciò che un bot ottimizzato sulle vittorie tende a eliminare.
- **Cosa non sappiamo:** come vadano davvero i bot (attuali o nuovi) contro persone. Senza dati su partite umane non si può dichiarare nulla di più.
- **Se si riprendesse il lavoro:** raccogliere (con consenso) i dati anonimi di partite umane, definire insieme alla forza anche la «varietà» e la «divertente prevedibilità» come obiettivi misurabili, e provare prima di tutto a migliorare il mini-gioco e la lettura del bluff dei bot attuali, con piccoli passi misurati nel laboratorio.

## 3.2 Report tecnico
1. **Esito del criterio di accettazione del progetto (prompt iniziale, §16).** Soddisfatti: baseline conservata e ripetibile; benchmark ripetibili e esportabili; tornei automatici; confronto tra versioni; previsione degli avversari e adattamento (misurati); tre livelli e personalità *dei bot attuali* misurati; nessuna dipendenza esterna. **Non soddisfatti:** «il nuovo motore dimostra miglioramenti rispetto alla baseline» (solo contro bot, in una configurazione degenere; non dopo correzione del comportamento a 3 e 4 giocatori); test con giocatori umani (una sola prova qualitativa, negativa); tre livelli e sette personalità per il motore nuovo (non realizzati); pannello grafico del laboratorio e misure di sfruttabilità, diversità delle strategie e popolazione/EGTA (non realizzati); integrazione stabile e prestazioni compatibili col Worker (picco ≈ 28 ms, non risolto). Per le regole del progetto («se una condizione non viene raggiunta non dichiarare il progetto completato») **il progetto non è completato e si interrompe**.
2. **Interpretazione.** (a) La **previsione dei voti** è il risultato scientificamente più solido: il segnale dominante è il segnalino (β = 1,28 contro 0,15 per l'affinità nei bot attuali), il modello per tipi con tipo di tavolo e prior «umile» è ben calibrato nella convergenza ma non generalizza a popolazioni che ignorano il segnalino (−1,435 contro −1,329 del vecchio modello). (b) Il **bot** ottimizza un'utilità (punti attesi) contro un modello dell'avversario: è una *risposta ottima a una popolazione* e di conseguenza **sfruttatore** e degenere; con un obiettivo di bluff aggiunto a mano il vantaggio si dissolve (parità a 4 giocatori, svantaggio a 3), segno che il margine è piccolo rispetto alla taratura dei bot attuali. (c) L'ipotesi che la «giusta» valutazione delle regole migliorasse i bot attuali è stata **falsificata** (NON CADE a +2 peggiora): le euristiche dei bot attuali incorporano correzioni empiriche non visibili nel codice.
3. **Validità.** Esiste un gap non colmato tra la metrica ottimizzata (vittorie/punti contro bot, stesso modello di percezione) e l'obiettivo reale (esperienza e forza contro persone). I benchmark bot contro bot sono validi per confrontare versioni *tra loro*, non per stimare la forza assoluta. Le misure di previsione hanno un rischio di circolarità (modello addestrato e provato su popolazioni di bot).
4. **Raccomandazioni per eventuali sviluppi.**
   - Raccogliere un registro anonimo e facoltativo delle decisioni nelle stanze con persone (carte, frase, segnalino, voti) per ristimare il prior (`fit-prior`) e validare contro umani; senza questo, ogni miglioramento resta non verificabile.
   - Trattare la **varietà del comportamento** come vincolo di progetto (distribuzione dei tipi di segnalino, quota di voti sul segnalino, entropia delle scelte) accanto alla forza; includere nel laboratorio avversari adattivi e una misura di **sfruttabilità** (miglior risposta contro il bot).
   - Interventi a basso rischio sui bot attuali, misurati nel laboratorio: strategia del mini-gioco (scelta della carta focale e rapidità: +2 ai voti in testa, +4 al più veloce), lettura del bluff, eventuale uso del segnalino come indizio nel modello di folla (oggi ignorato), sempre con confronto contro la baseline (≥ 1.000 partite, IC 95%).
   - Prima di qualunque integrazione nel Worker: misurare il picco di CPU sul runtime reale e ridurre il costo (cache delle previsioni, griglia dei tipi più rada).
5. **Stato del repository dopo la decisione.** `main` è invariato (bot attuali). Il lavoro sperimentale resta consultabile nel ramo `ccr-2a3ea292-gtapcw` (PR #35 chiusa e non unita); il ramo `backup/main-6e2f4b1-prima-dei-bot-strategici` è identico a `main` prima del lavoro. Il tag `baseline-ai-v1` esiste solo nell'ambiente locale di sviluppo (il push dei tag è stato rifiutato): il commit di riferimento è `6e2f4b1`. L'anteprima pubblicata contiene il codice del ramo finché una nuova PR non la sovrascrive.

---

# Appendice — Riproducibilità e riferimenti

**Comandi** (nel ramo `ccr-2a3ea292-gtapcw`): `npm run lab -- --games 1000 --seed 1000 --participants production:hard,production:medium,production:hard,production:medium --compare production:hard production:medium` (livelli); `npm run lab -- predict-eval --games 800 --players 5` (previsioni); `npm run lab -- fit-prior --games 1500` (prior). Semi usati: 1000 (livelli e prime taratura), 777000/888000/666000 (verifiche), 31337 (addestramento), 424242 (prova previsioni). Documentazione completa nel ramo: `docs/AI_RESEARCH.md`, `AI_ARCHITECTURE.md`, `AI_ALGORITHMS.md`, `AI_BENCHMARKS.md`, `AI_LABORATORY.md`, `AI_CHANGELOG.md`, `AI_ROLLBACK.md`.

**Riferimenti principali (abstract e schede ufficiali consultati; testi integrali non letti):**
- Albrecht & Stone (2018), *Autonomous Agents Modelling Other Agents*, Artificial Intelligence 258:66–95, DOI 10.1016/j.artint.2018.01.002.
- Camerer, Ho & Chong (2004), *A Cognitive Hierarchy Model of Games*, QJE 119(3):861–898.
- McKelvey & Palfrey (1995), *Quantal Response Equilibria for Normal Form Games*, Games and Economic Behavior 10(1):6–38.
- Tak, Lanctot & Winands (2014), *Monte Carlo Tree Search Variants for Simultaneous Move Games*, IEEE CIG, DOI 10.1109/CIG.2014.6932889.
- Cowling, Powley & Whitehouse (2012), *Information Set Monte Carlo Tree Search*, IEEE TCIAIG 4(2).
- Zinkevich et al. (2007/2008), *Regret Minimization in Games with Incomplete Information*, NIPS 20; Lanctot et al. (2017), *A Unified Game-Theoretic Approach to Multiagent RL* (PSRO), arXiv:1711.00832; Bighashdel et al. (2024), *PSRO: A Survey*, IJCAI-24; Serrino et al. (2019), *Finding Friend and Foe in Multi-Agent Games*, NeurIPS.
Tecniche valutate e non adottate: CFR/Deep CFR, MCTS ad albero profondo, PSRO con reti neurali (motivi in `docs/AI_RESEARCH.md`).
