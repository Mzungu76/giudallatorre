# STATISTICHE — le statistiche personali del giocatore

Pagina **`/statistiche`** (icona a barre in Home, accanto a condividi/installa). Mostra i numeri di chi usa quel dispositivo e **restano solo lì**: nessun dato va al server, nessun account. Funzionano anche con l'app installata (PWA).

## Dove sono salvate
- `apps/web/src/lib/stats.ts`: un solo documento in **IndexedDB** (`gdt-stats` → `kv` → `db`), con ripiego su `localStorage` (`gdt.stats`) se IndexedDB non c'è (navigazione privata, browser vecchi).
- Il documento contiene i **contatori complessivi** (restano per sempre), le **ultime 30 partite** e un elenco di chiavi già contate (per non contare due volte la stessa cosa se l'app si ricarica o si riconnette).
- Si cancellano col pulsante «Cancella le statistiche» (due tocchi) o cancellando i dati del sito dal browser. Cambiando telefono o browser ripartono da zero.

## Cosa si conta
| Dato | Quando |
|---|---|
| Partite, vittorie, podi (1°–3°, da 3 giocatori in su), punti totali, media, miglior punteggio, storico (data, giocatori, posto, punti, «con bot») | a fine partita |
| Voti da Folla e **intuito** (quante volte la carta votata è caduta); tue carte cadute; tuoi voti annullati da VOTI NULLI! | a ogni turno risolto |
| Turni da Megafono; segnalini CADE / NON CADE / VOTI NULLI! usati e quanti hanno colpito | a ogni turno risolto, se sei il Megafono |
| Intervalli giocati, azzeccati (voto su una carta in testa), «più veloce» | a ogni intervallo |

Le partite con bot contano come le altre (sono segnate «con bot» nello storico). Chi guarda soltanto (schermo condiviso, spettatori) non registra nulla.

## Come funziona
`observe(db, codiceStanza, vista, conBot)` è una funzione pura che guarda la vista del giocatore (`PlayerView`) e aggiorna il documento; la stanza la chiama a ogni cambio di fase (`Room.tsx`). Una «partita» finisce a `GAME_OVER`; se nella stessa stanza si ricomincia, i turni ripartono da capo e si apre una partita nuova. Test: `apps/web/tests/stats.test.ts`.

## Limiti
Nessuna sincronizzazione tra dispositivi, nessuna esportazione (si può aggiungere). I testi sono in `public/testi.json` (chiavi `st.*`).

## Livelli (50)
Il livello si calcola dai contatori già salvati (`apps/web/src/lib/livelli.ts`): niente dati in più, e chi ha già giocato trova subito il suo livello.
- **Esperienza (XP)**: partita finita +25, sul podio +15, vittoria +25, ogni punto +1, ogni voto da Folla +1, carta votata che cade +4, turno da Megafono +6, segnalino a segno +10, intervallo giocato +5, azzeccato +10, più veloce +15. Una partita vinta vale circa 100 XP.
- **Soglie**: XP per il livello *n* = 40 × (n−1)^1,5, arrotondato a 10 (livello 2 = 40 XP, 10 ≈ 1.140, 25 ≈ 5.060, 50 ≈ 13.720). Il passaggio da un livello al successivo costa sempre di più (da 40 XP a oltre 400 XP).
- **Titoli** (`lv.1`…`lv.50` in `public/testi.json`) e **icone** (emoji, in `ICONS`): cinque fasce da dieci livelli, ognuna col suo colore: Fondamenta (1–10), Salita (11–20), Vertigine (21–30), Cima (31–40), Leggenda (41–50).
- Per cambiare le regole basta modificare `XP` e `xpFor` in `livelli.ts`; il test `livelli.test.ts` controlla 50 livelli, icone e titoli distinti, crescita non lineare.
