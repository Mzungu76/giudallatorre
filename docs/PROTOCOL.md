# PROTOCOLLO — HTTP e WebSocket (`packages/game-protocol`)

Tutti i messaggi sono validati lato server con **zod** (schemi *strict*: campi extra = errore). L'identità del mittente non viaggia mai nei messaggi: la decide il server dal token.

## HTTP (stesso dominio dell'app)
| Metodo e percorso | Corpo | Risposta |
|---|---|---|
| `POST /api/rooms` | `{nickname, mode?: "table"\|"remote", megafonoSa?: boolean, bots?: {count: 0–7, level: "easy"\|"medium"\|"hard"}}` | `{code, playerId, token}` — crea la stanza, chi crea è host |
| `POST /api/rooms/:code/join` | `{nickname}` | `{code, playerId, token}`; 409 se `NICKNAME_TAKEN`, `ROOM_FULL`, `GAME_STARTED` |
| `GET /api/rooms/:code/info` | — | `{exists, stage?, players?, full?, mode?}` (nessun dato privato) |
| `GET /ws/:code` (Upgrade) | — | WebSocket; il primo messaggio deve essere `hello` |
| `GET /api/health` | — | `{ok:true}` |

Codice stanza: 5 caratteri da `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (senza I, L, O, 0, 1). Nickname: 1–16 caratteri (lettere, numeri, spazi, `_ . ' -`), unico nella stanza senza distinguere maiuscole. Token: 128 bit casuali (22 caratteri); il server conserva solo l'hash SHA-256.

## WebSocket — client → server
| `t` | Campi | Note |
|---|---|---|
| `hello` | `token` | **obbligatorio come primo messaggio** (entro 10 s) |
| `ping` | — | risposta `{"t":"pong"}` automatica, senza svegliare la stanza (stringa esatta `{"t":"ping"}`) |
| `setOptions` | `megafonoSa?`, `mode?`, `turnTimerSec?` (0/30/60/90/120), `ageBand?` (6/10/14/18, predefinita 14), `confessions?` (carte «Ammetto…», predefinita sì) | solo host, solo lobby |
| `kick` | `playerId` | solo host, solo lobby |
| `chat` | `text` (≤ 140 caratteri dopo la pulizia) | messaggio a tutta la stanza; errori `INVALID_MESSAGE`, `RATE_LIMIT` |
| `start` | — | solo host, da 3 giocatori (i bot contano) |
| `addBot` | `level` (`easy`\|`medium`\|`hard`) | solo host, solo lobby, fino a 8 giocatori totali |
| `removeBot` | `playerId` | solo host, solo lobby |
| `watch` | — | schermo condiviso (sola visione, solo dati pubblici) |
| `leave` | — | in lobby esce; in partita chiude soltanto la connessione |
| `act` | `reqId?`, `action` | azioni di gioco: `choosePhrase{mode:"card",index}\|{mode:"free", text?}` (testo libero opzionale, max 80 caratteri; senza testo la frase è solo a voce), `playCard{cardId}`, `placeLui{kind,position}`, `vote{position, reason?}` (con `justifyVotes` la frase è obbligatoria, max 80 caratteri), `advance` |

## WebSocket — server → client
`room` (stanza, giocatori e presenza, opzioni, `seq`), `view` (vista privata del giocatore + eventi per le animazioni + `deadline` del timer), `chat{msg}` e `chatlog{msgs}` (cronologia alla connessione), `error{code,message,reqId?}`, `kicked`, `closed{reason}`, `pong`.

Dopo **ogni** cambiamento ogni giocatore connesso riceve `room` e `view` con `seq` crescente. Alla (ri)connessione riceve subito uno snapshot completo: nessun ricaricamento della pagina e nessuna perdita di stato.

## Codici di chiusura
4001 token non valido · 4002 sostituita da una connessione più recente · 4003 espulso · 4004 stanza chiusa · 4008 troppi messaggi · 4400 messaggio non valido · 4401 `hello` mancante/scaduto · 1009 messaggio troppo grande (>2 KB).

## Errori di gioco (`error.code`)
`WRONG_PHASE`, `NOT_ALLOWED`, `ALREADY_DONE` (doppio invio/voto), `CARD_NOT_IN_HAND`, `INVALID_POSITION`, `INVALID_CHOICE`, `NOT_HOST`, `WRONG_STAGE`, `NOT_ENOUGH_PLAYERS`, `INVALID_TARGET`, `INVALID_MESSAGE`, `RATE_LIMIT`, `BAD_TOKEN`. Gli errori non chiudono la connessione e riportano `reqId`; i messaggi fuori sequenza (per esempio un voto mentre si gioca) sono semplicemente rifiutati.

## Giocatori virtuali (bot)
I bot sono giocatori della stanza (`isBot`, `level` in `room.players`) senza token né connessione: li fa agire il server (`RoomCore.tick`, 0,9–2 s di ritardo "umano") usando solo la vista che avrebbe un giocatore vero (`packages/game-engine/src/ai.ts`). Vedi `docs/BOTS.md`.
