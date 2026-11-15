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

## Cosa non c'è ancora
- **Canale stereotipi** (tabella riga per riga, rivista dal proprietario, con tetto): previsto in un secondo passo, non attivo.
- **Calibrazione sulle persone** (quanto è larga la popolazione di lenti, quanto pesa ogni bias): i valori sono ipotesi.
- La preferenza per la propria carta per il Megafono non esiste (non gioca carte).

## Nota collegata (intervalli)
Con l'intervallo a 4 carte e 2 giri, `planMiniVote` doveva usare `MINI_CYCLES` invece del 3 fisso: corretto nei bot v2 (`TUNE.miniFix`, predefinito 1). Il file `ai.ts` dei bot «attuali» (protetto) conserva il 3: vota comunque, con tempi un po' diversi dal previsto.
