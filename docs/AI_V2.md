# AI_V2 — miglioramento misurato dei bot attuali

Metodo: i bot attuali (`ai.ts`) restano **intoccati** (impronta controllata da test). La v2 è una **copia** (`packages/game-engine/src/ai-v2/ai.ts`) con leve regolabili, misurate nell'AI Laboratory (`docs/AI_LABORATORY.md`) una alla volta. Con le leve a 0 la v2 decide **come i bot attuali** (test, partite intere identiche). Vincoli: oltre alle vittorie si guarda il comportamento (tipi di segnalino, quota di voti sul segnalino), perché un tentativo precedente (PR #35, chiusa) vinceva di più ma giocava in modo degenere e prevedibile (vedi `docs/RELAZIONE_BOT_AI.md`).

## Leve (prima iterazione)
1. **`markBoost`**: il segnalino posato attira i voti. Nel modello di folla dei bot (stima del voto degli altri) si aggiunge un peso alla carta col segnalino, sia per chi vota sia per il Megafono che sceglie dove posarlo (il voto degli altri dipende da dove lo mette). I bot attuali ignorano questo indizio.
2. **`adaptFollow`**: il peso si adatta a ogni avversario in base a quante volte ha votato la carta col segnalino nei turni già conclusi (stima con prior debole: nessuna «personalità» da pochi dati).
Predefiniti v2: `markBoost = 1,5`, `adaptFollow = 1`.

## Misure (bot contro bot, mazzi ed etichette reali, mosse simultanee, confronto appaiato, IC 95%)
Taratura su seme 555000 (600 partite, 4 giocatori, v2 contro bot attuali Difficili):
| Configurazione | Punti | Vittorie | Megafono: CADE / NON CADE / VOTI NULLI! | Folla: vota il segnalino |
|---|---|---|---|---|
| tutte le leve spente (controllo A/A) | −0,24 ± 0,33 | +1,0 ± 4,0 pp | 64% / 6% / 30% | 87% |
| markBoost 0,5 | +0,79 ± 0,34 | +5,0 ± 4,0 pp | 62 / 6 / 32 | 87% |
| markBoost 1 | +1,31 ± 0,34 | +7,0 ± 4,0 pp | 63 / 4 / 33 | 88% |
| markBoost 1,5 | +1,92 ± 0,34 | +12,0 ± 3,9 pp | 58 / 3 / 40 | 89% |
| **markBoost 1,5 + adattamento** | **+2,04 ± 0,34** | **+13,3 ± 3,9 pp** | 54 / 3 / 43 | 89% |
| markBoost 2 + adattamento | +2,65 ± 0,36 | +17,0 ± 3,8 pp | 38 / 2 / **59** | 89% |
| markBoost 3 + adattamento | +2,04 ± 0,32 | +12,7 ± 3,9 pp | 7 / 0 / **93** | 90% |
Pesi più alti dànno più punti ma spostano il comportamento verso VOTI NULLI! quasi sempre (degenere in un'altra direzione): scelto 1,5.

**Verifica su semi nuovi** (seme 777777, 800 partite, configurazione scelta):
| Tavolo | Punti v2 − attuali | Vittorie v2 − attuali |
|---|---|---|
| 4 giocatori (2 contro 2) contro Difficili | +1,85 ± 0,31 | +11,8 ± 3,4 pp |
| 6 giocatori (3 contro 3) contro Difficili | +4,03 ± 0,36 | +14,2 ± 2,1 pp |
| 3 giocatori (2 v2 contro 1 attuale) | +1,79 ± 0,37 | +13,6 ± 4,5 pp |
| 4 giocatori contro Medi | +4,55 ± 0,35 | +24,9 ± 3,0 pp |
| 4 giocatori contro Facili | +5,69 ± 0,41 | +26,4 ± 2,9 pp |

**Costo:** nel Worker (stanza da 6 giocatori, tick più pesante su 5 partite) v2 44,7 ms contro 52,8 ms dei bot attuali: nessun peggioramento misurabile.

## Limiti (onesti)
- **Bot contro bot**: il vantaggio può dipendere dal fatto che i bot attuali seguono molto il segnalino (87% in questo tavolo). Non dice nulla sulla forza contro persone.
- **Comportamento**: più VOTI NULLI! (30% → 40–43% a 4 giocatori; a 3 giocatori il Megafono v2 sceglie VOTI NULLI! il 71% delle volte in questa prova) e **NON CADE resta raro** (3–6%, come nei bot attuali). La varietà non è migliorata, è solo rimasta vicina a quella dei bot attuali.
- Parametri tarati su un seme, verifiche su semi diversi; numero di varianti provate limitato (7).
- Non tocca: mini-gioco, lettura del bluff, memoria tra partite, etichette scritte a mano.

## Provarla con una persona
Solo nelle stanze di collaudo, spenta di default: `/crea?debug=bot&motore=v2`. Senza il parametro i bot sono quelli di sempre (test). Ritorno: `docs/AI_ROLLBACK.md`.
