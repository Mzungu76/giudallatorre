# AI_ALGORITHMS — gli algoritmi del motore strategico

Stato: **Fasi 4–5** (Opponent Model, previsione dei voti, simulazione e primo bot). I componenti successivi (simulazione, valutazione per probabilità di vittoria, livelli, personalità, memoria tra partite) si aggiungono qui man mano. Codice in `packages/strategic-ai/src/opponents/`; misure in `AI_BENCHMARKS.md` §5; fonti in `AI_RESEARCH.md`.

## 1. Cosa prevede il modello
Dato un turno al momento del voto, la probabilità che **ogni altro giocatore** voti ciascuna carta della Torre. Da qui si ricavano: quale carta sarà la più votata dagli altri, con che probabilità almeno *m* altri convergono sulla stessa carta, e la probabilità che ogni carta **cada** (`predictCrowd`, `predictFall`). È il mattone che userà il valutatore delle azioni (Fase 5–6): se so cosa voteranno gli altri, so quanto vale ogni mia scelta.

Usa **solo** ciò che il giocatore sa: ciò che è visibile al voto (carte, frase, *posizione* del segnalino, la propria carta) e ciò che è stato rivelato allo spoglio dei turni precedenti. Un test verifica che le previsioni non cambino se si alterano i dati nascosti.

## 2. Il modello di scelta (risposta quantale)
Ogni carta *k* ha un vettore di caratteristiche *x_k* (`optionFeatures`):

| Caratteristica | Significato |
|---|---|
| `aff` | affinità carta↔frase (etichette nascoste dei bot, `tags.ts`), centrata sulla Torre; 0 se mancano le etichette |
| `top` | la carta è (tra) la più affine |
| `mark` | la carta porta il segnalino del Megafono (si vede *dove*, non *quale*) |
| `own` | è la carta che il votante stesso ha giocato |
| `first`, `last` | prima / ultima posizione (abitudini di posizione) |

La probabilità di votare *k* è un **logit multinomiale** `softmax(β·x)` (McKelvey & Palfrey 1995). Con la carta del votante ignota si marginalizza: è una a caso tra quelle che non sono la mia. I coefficienti β sono diversi per la **Folla** e per il **Megafono** (che vota sapendo il proprio segnalino).

## 3. Il prior della popolazione
I β medi si stimano dal laboratorio (`npm run lab -- fit-prior`): MAP con prior debole sui voti di migliaia di partite dei bot attuali, con una divisione addestramento/validazione su partite diverse. Risultato attuale (`prior.fitted.json`, 1.500 partite, 39.685 voti):

| | aff | top | mark | own | first | last |
|---|---|---|---|---|---|---|
| Folla | 0,15 | 0,46 | **1,28** | 0,52 | 0,02 | 0,01 |
| Megafono | 0,22 | 0,10 | 0,54 | **1,02** | −0,03 | 0,00 |

Lettura: i votanti seguono soprattutto **dove è posato il segnalino**; il Megafono vota soprattutto **la propria carta**; non ci sono abitudini di posizione (come atteso per i bot). **Questo prior descrive i bot attuali, non le persone**: va ristimato con dati umani (`fit-prior` è pensato per questo).

## 4. Adattamento al singolo giocatore: ragionamento per tipi
Ogni giocatore ha un **tipo** `(λ, ε)` (Albrecht & Stone 2018: ragionamento per tipi):

`P(vota k) = ε/n + (1 − ε) · softmax_k(λ · β·x)`

λ = quanto è netto nel seguire gli indizi (1 = come la popolazione), ε = quanto spesso vota a caso. Il tipo non si osserva: si tiene una **distribuzione sui tipi** su una griglia (7 valori di λ × 6 di ε), che parte dai pesi della popolazione (stimati con **EM** dai voti dei giocatori, `fitTypeWeights`) e si aggiorna con il teorema di Bayes a ogni voto visto (`typePosterior`). La previsione è la miscela dei tipi pesata dal posteriore. Proprietà volute:
- **Nessuna personalità da pochi dati**: dopo 1 voto la distribuzione è praticamente quella della popolazione (test); si stringe solo con più voti.
- **Dimenticanza**: parametro `decay` (default 1 = nessuna) per dare meno peso ai voti vecchi (serve alla memoria tra partite, Fase 7).
- λ ed ε non sono identificabili separatamente (una miscela molto casuale somiglia a una poco netta): conta la previsione, non il valore dei singoli parametri (test).

**Tipo di tavolo (κ = 4).** Il prior di un giocatore è un mix tra la popolazione (peso κ) e i posteriori degli *altri* avversari: un tavolo di principianti o di esperti si riconosce mettendo in comune le prove di tutti. Aiuta nei tavoli omogenei, è neutro in quelli misti (§5 di `AI_BENCHMARKS.md`).

**Altre modalità** (confronto, non predefinite): `coef` (ogni coefficiente libero con prior gaussiano), `scale` (solo λ), `scale+coef`. Solo `coef` e `scale+coef` possono imparare abitudini individuali di posizione (non presenti nei bot, quindi non misurabili qui); `types` no.

## 5. Dipendenze tra le decisioni
Il modello tratta i voti come indipendenti **dati** gli indizi condivisi (affinità, segnalino): la convergenza sulla stessa carta nasce dagli indizi comuni. Verifica: la probabilità prevista che almeno *m* altri votino la stessa carta coincide con quella osservata (es. 5 giocatori: 89,7% prevista contro 89,8% osservata per *m*=2; 33,0% / 33,0% per *m*=3; 6,3% / 6,2% per *m*=4). Non serve un fattore latente aggiuntivo (a 8 giocatori lo scarto massimo è 1,3 punti percentuali per *m*=3).

## 6. Caduta e segnalino
`predictFall` estrae i voti degli altri dalle distribuzioni, applica le regole del motore (`tallyMarks`: VOTI NULLI!, CADE nel pareggio) e dà la probabilità che ogni carta cada. Il **tipo** di segnalino, ignoto agli altri, si estrae uniforme tra i tre (o si passa quello noto al Megafono). Limite: una stima migliore del tipo (Ability Evaluator) arriva con la Fase 6.

## 7. Costo
Misurato (sviluppo, `tsx`): `predictVotes` ≈ 0,4 ms (3 giocatori), 0,8 ms (5), 2,2 ms (8, con 7 turni di storia); `predictFall` con 400 campioni ≈ 1 ms. Cresce con giocatori × possibili posizioni della propria carta × tipi (42). Una sola previsione per decisione è compatibile con il budget; più previsioni (simulazioni) richiederanno una versione con cache o una griglia più rada (Fase 10).

## 8. Limiti noti (misurati)
- **Addestrato e provato su bot**: i bot di un livello condividono parametri, le persone no. I guadagni dell'adattamento individuale con le persone potrebbero essere maggiori (più eterogeneità) o minori (più rumore): non misurabile qui.
- **Tavolo di soli Facili**: resta previsto peggio del caso (−1,649 contro −1,609) anche dopo l'adattamento: i Facili seguono gli indizi in modo *qualitativamente* diverso, non solo meno netto. Rimedio previsto: tipi con coefficienti propri (miscela di esperti) quando ci saranno dati umani.
- **Votanti Medi**: l'adattamento li prevede leggermente peggio (−0,010/−0,015): sono il centro del prior e l'adattamento aggiunge solo rumore.
- **Intervalli di confidenza**: calcolati trattando le osservazioni come indipendenti; lo stesso voto è previsto da più osservatori, quindi gli intervalli veri sono più larghi (fino a ~√(n−1) volte). Le differenze riportate sono comunque molto più grandi dell'errore.
- Il modello non ha un termine per il punteggio o la classifica (chi è in testa viene ostacolato?): non osservabile nei bot, da aggiungere con i dati umani.

## 9. Simulation Engine e primo bot (Fase 5)
Codice: `packages/strategic-ai/src/sim/montecarlo.ts`, `src/engines/strategic.ts`.

**Il turno come gioco a mosse simultanee.** Nessuno vede cosa fanno gli altri nello stesso passo. Non si usa quindi un albero sequenziale (Tak, Lanctot, Winands 2014): i voti degli altri si **campionano dal modello** (indipendenti dati gli indizi, §5) e per ogni mia scelta si calcola il punteggio con le regole ufficiali (`scoreTurn`). È una risposta ottima al comportamento previsto (livello 1 nella gerarchia cognitiva di Camerer et al.); la scelta finale è **mista** (softmax con temperatura, come la risposta quantale) per non essere prevedibile.

**Monte Carlo** (`evaluateCandidates`): numeri casuali comuni (ogni candidato è valutato sugli stessi mondi), arresto anticipato quando il migliore batte il secondo con differenza appaiata significativa (z = 3, dopo almeno 40 simulazioni), tetto di 120 simulazioni, **limite di tempo** (`budgetMs`: allo scadere restituisce la migliore stima trovata).

**Decisioni del bot** (`strategic-pts` / `strategic-win`, entrambi decidono solo dall'`Observation`):
- *Posa del segnalino* (Megafono): per ogni posizione prevede i voti degli altri col segnalino lì, poi valuta ogni (posizione, tipo, mio voto) e sceglie tra le combinazioni (posizione, tipo) col valore migliore.
- *Voto*: valuta ogni carta votabile contro i voti previsti degli altri; il tipo di segnalino altrui, ignoto, è estratto uniforme tra i tre (il Megafono conosce il proprio).
- *Frase e carta da giocare*: euristica di affinità (come i bot attuali); non sono ancora ottimizzate.
- *Intervallo*: a caso.

**Obiettivo.** `points`: punti attesi (Megafono: vantaggio sulla media degli altri). `win`: probabilità di vincere ≈ prodotto sugli avversari di Φ(distacco / σ), con σ = √(σ₀² + turni_rimasti·σ_t²) (σ₀ = σ_t = 8). Misurato: `win` batte i bot attuali ma **non** la variante `points` (`AI_BENCHMARKS.md` §6).

**Perché un po' di casualità.** Con temperatura 0 un bot sarebbe prevedibile da un avversario che impara; τ = 0,05 non costa punti (plateau tra 0 e 0,06) ma evita il comportamento deterministico. La sfruttabilità vera si misura nella Fase 9.

**Cosa non fa ancora**: nessuna previsione oltre il turno (niente rollout della partita), nessuna valutazione del tipo di segnalino altrui, nessun livello di difficoltà né personalità, nessuna memoria tra partite, nessun modello dell'intervallo.
