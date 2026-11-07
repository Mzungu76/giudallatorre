# Giocatori virtuali (bot)

**Cosa sono.** Giocatori controllati dal server che riempiono la stanza (da 3 a 8 giocatori in totale, bot compresi). Si possono aggiungere alla creazione ("Gioca da solo (con bot)" o il selettore "Giocatori virtuali") e nella lobby (`+ Giocatore virtuale`, con livello). Si tolgono con la ×. Il bot ha il tag **BOT · livello** nella lista.

**Livelli** (`packages/game-engine/src/ai.ts`, funzione pura `chooseBotAction`):
| Livello | Comportamento |
|---|---|
| Facile | sceglie a caso (carta, Lui!, voto) |
| Medio | ricorda quali carte sono già cadute/mostrate nei turni passati e stima la probabilità di caduta; scommette il Lui! (CADE/NON CADE) sul valore atteso (CADE = 5p−1, NON CADE = 1−2p); vota la carta più probabile |
| Difficile | come il medio + bonus per il voto sulla propria carta giocata e coerenza con il pareggio (se il Megafono è lui, vota la carta che vuole far cadere) |

**Limiti dichiarati.** I bot non leggono le frasi né capiscono le immagini: sono competitivi solo sul piano tattico (probabilità, punteggio, pareggi). Il giudizio "umoristico" resta agli umani. Nei test simulati (3 bot facili contro 1 difficile, 4 giocatori) il difficile vince il 53% delle partite contro il 25% del caso e fa in media 16,4 punti contro 11,8.

**Regole speciali.** I bot non hanno token (la loro azione parte dal server); se il Megafono è un bot qualunque umano può far proseguire dopo i risultati; in assenza di umani connessi la stanza si chiude come le altre. La memoria dei bot (`botMem`) è salvata nello stato della stanza e sopravvive a un riavvio del Durable Object.

**Sicurezza.** Le viste dei bot sono costruite come quelle dei giocatori (`viewFor`): nessun bot vede le mani altrui o il tipo del Lui! prima del tempo. Test: `packages/game-engine/tests/ai.test.ts`, `worker/tests/roomcore.test.ts` ("giocatori virtuali nella stanza"), `scripts/e2e-solo.mjs`.

## Etichette nascoste, gregge e bluff
Ogni personaggio (120) ha un tipo umano e dei temi (`content/tags-personaggi.json`, scritti a mano); ogni frase (250) ha temi e tipo derivati dal contesto e da parole chiave (`content/tags-frasi.json`, `tools/make_tags.py`). Non vengono mai inviate ai client. I bot stimano l'affinità (temi in comune ×2, tipo ×3) per:
- **giocare la carta** che meglio rappresenta la frase;
- **votare** la carta che il gruppo voterà; il Difficile tiene conto del gregge (se cade la carta votata anche dal Megafono, i suoi +2 non contano) stimando il voto segreto del Megafono (la carta del Lui! con la probabilità che sia "Cade lui!", altrimenti la più probabile);
- **fare il Megafono**: scelgono "Cade lui!" o "Non cade" e la carta in base al valore atteso e alla reputazione (se tutti lo credono sempre "Cade lui!", ogni tanto scommette "Non cade" sulla carta ovvia per spaventare il gruppo: il bluff; se lo credono prudente, ogni tanto tenta il colpo); poi vota la carta più probabile, così il gregge lavora per lui; il Difficile preferisce le frasi con più etichette.
Misure (mazzo reale, `tools/analysis/bot-bench.ts`, `bot-mega.ts`): Medio e Difficile battono i bot Facili nel 64–70% delle partite a 4 (25% è il caso); il Megafono Medio e Difficile fanno 4,3 punti a turno contro 1,7 del Facile, e il Difficile azzecca "Cade lui!" nel 92% dei casi. **Medio e Difficile si equivalgono tra bot**: con parametri più aggressivi il bluff e la paura del gregge facevano perdere circa 2 punti contro bot che non li usano, quindi sono tarati bassi (`TUNE` in `ai.ts`). Il valore del bluff si vedrà solo contro persone.
