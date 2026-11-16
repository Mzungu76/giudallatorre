# BOT_LENTI — bot con «occhi diversi» (v2o, sperimentale)

Opzione di collaudo: **`/crea?debug=bot&motore=v2o`**. Non è il predefinito (resta v2e). Interruttore generale: `V2_BOTS_ENABLED` (docs/AI_ROLLBACK.md). Codice: `packages/game-engine/src/ai-v2/lens.ts`, `tags2.ts` (`affinityLens`), `ai.ts` (`chooseBotActionLens`, contesto `CUR`).

## Idea
Le persone non guardano le carte allo stesso modo: ognuno vede un personaggio da un'angolazione sua, ha scorciatoie mentali e sa (più o meno) che gli altri ne hanno. Ogni bot riceve una **lente**, estratta a inizio partita da (giocatore, stanza) e **fissa per tutta la partita**. La lente cambia come stima il gruppo e come vota; i punti attesi (il motore EV di prima) restano il criterio di tattica.

## I bias della lente (ipotesi iniziali, da tarare con partite vere)
| Bias | Parametro | Effetto |
|---|---|---|
| Associazioni larghe o letterali | `reach` 0,2–0,8 | peso delle etichette imparentate nell'affinità |
| Salienza | `sal` 0–0,6 | le carte ricche di tratti forti attirano lo sguardo |
| Posizione | `posKind`, `posG` | preferenza per prima / ultima / centrale |
| Ripetizione | `rho` −0,4…+0,4 | «non può ricadere» (−) o «è in serie» (+) sulla carta caduta il turno prima |
| Effetto alone | `halo` 0–0,4 | il tratto più forte trascina le altre associazioni |
| Fiducia nel segnalino | `markGain` 0,4–1,6 | moltiplica l'attrazione del segnalino |
| **Propria carta** | `own` 0,2–1,1 | la carta che ho giocato spicca per riconoscimento e attira il voto anche se non è la più forte |
| Seconda lettura | `angle` 0–0,5 | per alcune carte, un'etichetta vicina che per quel bot spicca |
| Gusto per il buffo | `fun` 0–0,5 | attrazione per le carte caricaturali, a prescindere dalla frase |
| Illusione di trasparenza | `trans` 0–0,35 | si crede più bravo a leggere il bluff (si somma alla profondità) |
| Falso consenso | `proj` 0–0,5 | immagina gli altri più simili a sé |

## Sapere che gli altri hanno bias
Per prevedere i voti, il bot non usa un modello unico: per ogni avversario estrae a caso una tra 6 «lenti immaginate» (popolazione, spostata verso la propria con `proj`), con la loro fiducia nel segnalino e, per chi non è il Megafono, la preferenza per **la propria carta** (che non conosce: una a caso tra quelle non sue). Su queste previsioni lavora il calcolo dei punti attesi, quindi tattiche come «CADE su ciò che i bias degli altri faranno votare» o «bluff sul tipo che non si aspettano» nascono da sole.

## Come il bias entra nel voto
Il gusto (salienza, posizione, ripetizione, buffo, propria carta) si somma ai **punti attesi** di ogni carta: `vals_k += lensPts × gusto_k`; la scelta è meno netta di un calcolatore: la temperatura del voto è moltiplicata per `lensTemp`. Predefiniti: `lensPts = 1,5`, `lensTemp = 4`.

## Misure (400 partite, 4 bot Difficili uguali; `docs`/laboratorio)
| Motore | Tutti la stessa carta | Voti sul segnalino | Voti sulla propria carta | Differenza di punti vs bot attuali (500 partite, 2 contro 2) |
|---|---|---|---|---|
| bot attuali | 70% | 87% | 22% | — |
| v2 | 70% | 88% | 21% | +2,3 ± 0,4 |
| v2m | 63% | 82% | 25% | +0,6 ± 0,5 |
| **v2o** (1,5 / 4) | **53%** | **76%** | **32%** | −0,1 ± 0,5 |
| v2o (2,5 / 6) | 41% | 69% | 37% | −0,9 ± 0,6 |
| v2o (3 / 10) | 29% | 62% | 40% | −2,0 ± 0,6 |

Lettura: i bot attuali, tra loro, votano **tutti la stessa carta in 7 turni su 10, quasi sempre quella col segnalino**: è l'equilibrio razionale del punteggio (seguire il segnalino rende), non un errore, ma è molto meno vario di un tavolo di persone. La varietà costa forza: con la dose predefinita v2o resta alla pari dei bot attuali; con dosi più alte il costo sale. La dose giusta non si trova in laboratorio (la «folla» sono altri bot): va decisa con le partite vere e con più giudici.

## Il segnalino del Megafono: prevedibilità (feedback della prima partita)
Osservazione del proprietario: «il Lui sulla carta più adatta, e se ce ne sono due o tre adatte, su una con VOTI NULLI!». Misura sui bot (4 uguali, Difficili, 400 partite): **CADE 62%, NON CADE 7%, VOTI NULLI! 31% per i bot attuali; con v2o prima delle modifiche CADE 45%, NON CADE 4%, NULLI 50%.** Il motivo è un equilibrio razionale: se tutti seguono il segnalino, annullare i voti sulla carta più votata toglie punti a tutti, quindi il calcolo lo sceglie; il valore di NON CADE nel calcolo è basso (+1 invece di +2: scelta storica dei bot attuali, che in laboratorio dava punti).

Modifiche in v2o (leve in `TUNE`):
- **Abitudini personali**: ogni bot ha una preferenza stabile per un tipo di segnalino (`prefCade/prefNon/prefNul`, ±1 punto atteso) e per la carta più ovvia o la trappola (`obv`).
- **Varietà rispetto al tavolo**: a ogni tavolo si ricorda come sono stati usati i segnalini (`mem.placed`); chi posa lo vara rispetto a ciò che gli altri si aspettano: `−varyPts × (quota del tipo − 1/3)`; chi vota legge le abitudini del tavolo (`habitPow`). Nota: in una partita ogni giocatore posa 1–2 volte, quindi la varietà si misura **tra giocatori**, non dentro lo stesso.
- **Scelta meno netta** (`placeTemp`).

| Impostazione | CADE / NON CADE / NULLI | Segnalino sulla carta più adatta | Punti vs bot attuali |
|---|---|---|---|
| bot attuali | 62% / 7% / 31% | 32% | — |
| v2o senza abitudini | 45% / 4% / 50% | 35% | −0,1 ± 0,5 |
| v2o (`placeTemp` 1,5, `varyPts` 5) — **predefinito** | 42% / 15% / 42% | 42% | −1,4 ± 0,5 (600 partite) |
| v2o (`varyPts` 3) | 48% / 7% / 45% | 43% | −0,8 ± 0,6 |
| v2o (`varyPts` 6) | 43% / 17% / 41% | 42% | −1,0 ± 0,6 |

(Il valore reale di NON CADE nel calcolo, `noncadePtsLens`, resta 1: portarlo a 2 non faceva giocare molto di più NON CADE e costava circa 0,8 punti.) La varietà costa forza: è una scelta di progetto da fare provando con persone. «Segnalino sulla carta più adatta» è la quota di turni in cui il segnalino sta sulla carta con più affinità secondo le etichette (con 4 carte, a caso, il 25%).

## Canale dei luoghi comuni (ruoli e mestieri)
File: `content/etichette/stereotipi.json` (voce per voce, con nota). Una carta che ha il tipo `ruolo` (politico, religioso, influencer, nerd, sportivo, artista, guru, complottista, genitore, ambizioso, festaiolo, ribelle) viene letta da chi ha quel pregiudizio anche come `tratto` (es. politico → ipocrita 3, bugiardo 2, furbo 2).
- **Perimetro deliberato**: solo ruoli, mestieri e sottoculture. **Niente corpo, età, sesso, origine o gruppi di persone**: un test (`etichette.test.ts`) lo impedisce (elenco chiuso dei ruoli ammessi). Le etichette delle carte restano quelle esistenti.
- **Come agisce**: ogni lente ha `stereo` (0–0,8) e, per ogni coppia ruolo→tratto, un'estrazione fissa per (bot, carta): ha quel luogo comune oppure no. Se lo ha, il tratto si aggiunge alla carta con peso `forza × stereo × 0,8`, con **tetto 2 per carta** (`STEREO_CAP`): nessuna carta attira voti solo per i pregiudizi. Gli altri sono immaginati con lenti pure con pregiudizi, quindi il bot sa che esistono anche negli altri.
- **Interruttore**: `TUNE.stereoOn` (1 = acceso, solo nei bot v2o). Per togliere un luogo comune: cancellare la riga dal JSON.
- **Verifica** (800 partite, 4 bot v2o): con/senza canale, la dispersione dei tassi di caduta tra le carte resta 5% → 5%: il canale sposta qualche carta di qualche punto (es. guru/moralista/eccentrico 22% → 32%, pignolo/nerd 24% → 30%) ma non concentra i voti su poche carte.

## Cosa non c'è ancora
- **Calibrazione sulle persone** (quanto è larga la popolazione di lenti, quanto pesa ogni bias): i valori sono ipotesi.
- La preferenza per la propria carta per il Megafono non esiste (non gioca carte).

## Nota collegata (intervalli)
Con l'intervallo a 4 carte e 2 giri, `planMiniVote` doveva usare `MINI_CYCLES` invece del 3 fisso: corretto nei bot v2 (`TUNE.miniFix`, predefinito 1). Il file `ai.ts` dei bot «attuali» (protetto) conserva il 3: vota comunque, con tempi un po' diversi dal previsto.
