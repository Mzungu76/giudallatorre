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
