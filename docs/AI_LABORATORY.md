# AI_LABORATORY — il laboratorio di ricerca dei bot

Scopo: far giocare tra loro versioni diverse dei bot, in migliaia di partite, e dire **con numeri e intervalli di confidenza** quale è migliore, in quali situazioni e di quanto. È ciò che permette ai bot di migliorare nel tempo senza «tarare a occhio».

Stato: **libreria + riga di comando** (`packages/ai-lab`), ripristinata dal lavoro sperimentale (PR #35, chiusa) senza il motore strategico, per migliorare i bot attuali con misure. Il pannello web, le visualizzazioni e le popolazioni di agenti arrivano nelle fasi 8–9 (vedi «Cosa manca»).

## Uso rapido
```bash
npm run lab -- --list                                   # versioni disponibili
npm run lab -- --games 1000 --seed 1000 --name prova \
  --participants baseline-1:hard,production:hard,baseline-1:hard,production:hard \
  --compare baseline-1 production --out lab-out/prova    # 4 giocatori: 2 con baseline-1, 2 con production
npm run lab -- --config lab-out/prova/config.json --out lab-out/ripetuta   # ripete l'esperimento: stesse partite, stessa impronta
```
Il partecipante si scrive `motore:livello[:carattere]`: motore = id di `BOT_ENGINES` (`baseline-1`, `production`); livello = `easy|medium|hard`; carattere = id di `BOT_STYLES`, `random` (uno a caso, distinto tra i posti come nelle stanze) o assente (neutro).

Opzioni: `--games`, `--players` (default = numero di partecipanti), `--seed`, `--lineup fixed|pool`, `--mini random|off` (intervallo a metà partita), `--tune motore.parametro=valore` (ripetibile), `--compare A B`, `--out cartella`.

## Come si gioca una partita nel laboratorio
- Mazzi, frasi ed etichette **reali** (come nelle stanze); fascia d'età predefinita; intervallo a metà partita come in gioco.
- **Mosse davvero simultanee**: a ogni passo tutti i giocatori decidono dallo *stesso* stato (nessuno vede l'azione di chi ha deciso prima), poi le azioni si applicano in ordine casuale (dal seme; conta solo per il «più veloce» dell'intervallo). Un test lo verifica.
- Motori **legacy** (stato → azione) ricevono lo stato completo, come in produzione, e per convenzione non leggono dati nascosti (`fairplay.test.ts`). 
- Tutta la casualità deriva dal seme: stessi partecipanti, posti e seme → stessa partita. I posti dei partecipanti sono rimescolati a ogni partita (dal seme) per togliere il vantaggio di chi gioca per primo.
- Controlli a ogni partita: conservazione delle carte e punteggi interi (`checkInvariants`); una partita con problemi è segnalata nel rapporto.

## Formazioni
- `fixed` (default): i partecipanti sono esattamente `players`; a ogni partita siedono in ordine casuale.
- `pool`: i partecipanti sono un gruppo più ampio; a ogni partita se ne estraggono `players` senza ripetizioni (per popolazioni eterogenee).

## Metriche (per partecipante, per livello, motore, carattere, numero di giocatori, posto)
| Metrica | Definizione |
|---|---|
| Vittorie | Quota di partite vinte; in caso di parità in testa 1/n a ciascun vincitore. IC 95% = ± 1,96·errore standard delle quote per partita. |
| Punti | Punteggio finale medio. |
| Posizione | 1 + numero di giocatori con più punti (i pari merito condividono il posto). |
| Margine | Punti − media dei punti degli altri nella stessa partita. |
| ms/decisione | Tempo medio di decisione (misura di prestazione, **non** fa parte dell'impronta). |

Confronto tra due gruppi (`--compare`): **differenza appaiata** per partita (stesso tavolo e seme): media del gruppo A − media del gruppo B, con IC 95%. «Rilevabile» = l'intervallo non contiene lo zero. `gamesNeeded(sd, delta)` stima quante partite servono per distinguere una differenza `delta`.

Non ancora presenti (fasi 4–9): accuratezza delle previsioni, diversità delle strategie, sfruttabilità, risultati per combinazione di segnalini, efficacia delle abilità.

## Uscite
`config.json` (per ripetere l'esperimento), `results.json` (configurazione, versioni e parametri effettivi dei motori, riepiloghi, tutte le partite, **impronta** dei risultati), `games.csv` (un record per posto e partita), `summary.csv` (riepiloghi per gruppo con IC). Nel terminale: tabella e confronto appaiato.

**Ripetibilità**: l'impronta (`resultsHash`) non include i tempi di calcolo; due esecuzioni con la stessa configurazione e le stesse versioni del codice la hanno identica (test).

## Parametri di taratura
`--tune baseline-1.cncTempHard=0.5` modifica un parametro di quella versione **solo durante il torneo** e lo ripristina alla fine, anche in caso di errore (test). Limite: i parametri dei motori legacy sono globali per versione, quindi due partecipanti della *stessa* versione non possono avere parametri diversi nella stessa partita (per confrontare due valori si usano due versioni, o due tornei).

## Aggiungere un motore
1. Motore legacy (stato → azione): una voce in `BOT_ENGINES` (`bot-engines.ts`).
3. Documentare la versione in `AI_CHANGELOG.md`; confrontarla con `baseline-1` con ≥ 1.000 partite per confronto.

## Cosa manca (tabella di marcia)
| Fase | Elemento |
|---|---|
| 8 | Pannello web (dietro `?debug`): selezione di partecipanti, livelli, personalità e versioni, grafici, confronto versioni, esportazione dal browser (Web Worker). |
| 9 | Benchmark automatici completi, sfruttabilità, ricerca di strategie dominanti, popolazione di agenti, analisi empirica (EGTA/PSRO parametrico), test con folle di percezione diversa. |
| — | Partite con persone: registro anonimo e facoltativo delle decisioni (da decidere con il proprietario). |
