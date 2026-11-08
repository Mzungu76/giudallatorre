# GAME_FLOW — macchina a stati del motore (`packages/game-engine`)

Il server è l'unica autorità: il client invia **azioni**, il motore le valida e produce un nuovo stato + eventi.

```mermaid
stateDiagram-v2
  [*] --> PROCLAIM: createGame (3..8 giocatori, 5 carte a testa)
  PROCLAIM --> PLAY: Megafono: choosePhrase (carta o frase libera)
  PLAY --> PLAY: playCard (ogni giocatore richiesto, una volta)
  PLAY --> SUSPECT: tutte giocate -> Torre mescolata e numerata
  SUSPECT --> VOTE: Megafono: placeLui (CADE / NON_CADE + posizione)
  VOTE --> VOTE: vote (tutti, Megafono incluso, una volta)
  VOTE --> RESULTS: tutti hanno votato -> esito e punti
  RESULTS --> PROCLAIM: advance (scarto, pescate, Megafono successivo)
  RESULTS --> GAME_OVER: advance, se tutti hanno fatto il Megafono 1 (4-8) / 2 (3) volte
  GAME_OVER --> [*]
```

| Fase | Chi agisce | Azione | Transizione |
|---|---|---|---|
| PROCLAIM | Megafono | `choosePhrase` (`card`+indice, oppure `free`) | PLAY; in modalità base pesca la carta dal mazzo per la Torre |
| PLAY | Folla (+ Megafono se "Megafono sa") | `playCard` | SUSPECT quando tutti hanno giocato |
| SUSPECT | Megafono | `placeLui` | VOTE |
| VOTE | tutti | `vote` | RESULTS quando tutti hanno votato |
| RESULTS | server / chiunque | `advance` | PROCLAIM o GAME_OVER |

Errori tipizzati (`EngineError`): WRONG_PHASE, NOT_ALLOWED, ALREADY_DONE (doppio invio/voto), CARD_NOT_IN_HAND, INVALID_POSITION, INVALID_CHOICE, UNKNOWN_PLAYER, GAME_OVER, DECK_EXHAUSTED.

Eventi trasversali gestiti dal backend (non dal motore): disconnessione/riconnessione, espulsione in lobby, timeout (il server può usare `suggestAction` per giocare al posto di un inattivo).
