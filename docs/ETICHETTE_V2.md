# ETICHETTE_V2 — la base di conoscenza dei bot («gli occhi dei bot»)

## Perché
Le etichette vecchie avevano tre difetti misurati: carte e frasi parlavano **vocabolari diversi** (31 etichette su 42 comparivano su un solo lato, quindi non potevano mai combaciare), le frasi erano etichettate da regole sulle parole (superficiali, spesso vuote) e il punteggio era grezzo (presente / assente).

## Cosa c'è ora (`content/etichette/`)
| File | Contenuto |
|---|---|
| `catalogo.json` | Vocabolario unico: **51 tipi umani** e **50 temi**, ciascuno con definizione; pesi 1 (marginale) – 3 (centrale); massimo 3 tipi e 6 temi per elemento. |
| `passate/frasi.A.txt`, `passate/carte.A.txt` | Passata A, leggibile a mano: `id|tipo1 tipo3|tema2 …` (numero = peso). 405 frasi, 119 immagini (la 120ª, `p14-i01`, è un duplicato di `p13-i01`). |
| `frasi.v2.json`, `personaggi.v2.json` | Risultato generato da `tools/etichette/consenso.py` (usato dal bot v2). |
| `revisione.frasi.json`, `revisione.personaggi.json` | Elementi dubbi, ordinati per priorità (188 frasi, 30 carte). |

Etichettatura: le carte sono state guardate una a una sulle illustrazioni; le frasi lette una a una. Copertura vocabolario: dopo il lavoro restano su un solo lato 6 tipi e 5 temi (prima 31 su 42): `ambiente`, `animali`, `giovinezza`, `musica` esistono sulle carte ma nessuna frase li tocca (**lacuna dei contenuti**, non delle etichette: servirebbero nuove frasi); `morte` solo sulle frasi.

## Come si controlla e si corregge
1. **Controlli automatici** (`packages/game-engine/tests/etichette.test.ts`): ogni frase/carta ha etichette, tutte nel catalogo, pesi 1–3, massimi rispettati, almeno un tipo, vocabolario condiviso entro soglia.
2. **Confronto con le etichette vecchie** (`consenso.py`): dove il vecchio sistema ha un tipo/tema che la passata A non ha, l'elemento è segnalato («tipo-diverso», «tema-diverso»). **Attenzione**: il vecchio sistema era debole, quindi molti dissensi sono miglioramenti, non errori; la priorità (2 = dissenso su tipo *e* tema) serve a guardare prima i casi più strani (20 frasi, poche carte).
3. **Revisione del proprietario**: apri `public/etichette.html` (nel browser, locale o dall'anteprima), carica `catalogo.json` e un file `revisione.*.json`, tocca le etichette per accendere/cambiare peso/spegnere, «Va bene così» per confermare, **Scarica le decisioni**. La pagina non pubblica nulla (le etichette restano fuori dal sito, altrimenti i giocatori potrebbero leggerle).
4. **Applicare**: `python3 tools/etichette/applica.py decisioni-etichette-frasi.json` aggiorna la passata A e rigenera i file v2 (poi `npm test`).

## Come le usa il bot (solo v2, spento di default)
`packages/game-engine/src/ai-v2/tags2.ts`: affinità = per ogni etichetta in comune, base (tipo 3, tema 2) × (peso carta + peso frase)/6. Leva `TUNE.labelsV2` (0 = come i bot attuali, **valore predefinito**). Le frasi senza etichette v2 (accuse del mini-gioco, confessioni, frasi nuove) usano il vecchio sistema. `ai.ts`, `tags.ts`, `bot.ts`, `botstyle.ts` non sono toccati (test di impronta).

## Revisione del proprietario (risultati)
- Campione di 30 (15 frasi + 15 carte, a caso): frasi 15/15 giuste; carte 11/15 giuste, 2 dubbie, 2 sbagliate.
- 24 carte dubbie: 11 giuste, 3 dubbie, 10 sbagliate → corrette 13 carte. Errore tipico: leggevo gli oggetti, non la storia del personaggio.
- Rilettura «per storia» delle altre 76 carte (passata B, `passate/carte.B.txt`): 28 aggiornate. Verifica a campione su 20: 16 giuste, 4 dubbie, 0 sbagliate; 6 carte affinate in base alle note.
- Totale carte viste dal proprietario: 83 su 119 (70%) (campioni e dubbie); le altre sono state rilette da me con il metodo corretto.

## Provare le etichette con persone: `?motore=v2e`
Nella stanza di collaudo: `/crea?debug=bot&motore=v2e` = bot v2 + etichette v2 (`chooseBotActionV2E` accende `TUNE.labelsV2` solo durante la chiamata, per stanza). Confronto: `?motore=v2` (v2 con etichette vecchie) e `/crea?debug=bot` (bot attuali). Solo con `debug`; kill switch `V2_BOTS_ENABLED` in `RoomCore.ts` (docs/AI_ROLLBACK.md).

## Cosa sappiamo e cosa no (onestà)
- **Bot contro bot, 600 partite, 4 giocatori difficili (2 v2 + 2 attuali)**: vantaggio di v2 sugli attuali 2,51 ± 0,36 punti con `labelsV2=0` e 2,08 ± 0,40 con `labelsV2=1`. Cioè le nuove etichette **non migliorano** il risultato in laboratorio, anzi lo riducono un po'. È atteso: in laboratorio la «folla» sono i bot attuali, che votano con le etichette *vecchie*; prevedere la loro folla con etichette diverse non può aiutare. **Il laboratorio non può dire se le nuove etichette descrivono meglio gli umani.** Per questo la leva resta spenta.
- La qualità vera si misura solo così: (a) la tua revisione di un campione e dei dubbi, (b) un test con persone su link di prova. Passo successivo proposto: aggiungere alla stanza di collaudo una scelta `?etichette=v2` e confrontare con tester quanto i bot «capiscono» chi cade.
- Passata B indipendente: non c'è un secondo etichettatore indipendente (sono tutte mie); il confronto con le etichette vecchie e il controllo di coerenza ne fanno le veci in modo parziale.
