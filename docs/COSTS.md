# COSTI E LIMITI GRATUITI (verificati il 2026-11-06 sulla documentazione ufficiale)

Fonte: developers.cloudflare.com/durable-objects/platform/pricing, /workers/platform/limits. **Rieseguire la verifica a ogni rilascio.**

| Risorsa | Piano Workers Free |
|---|---|
| Richieste Worker | 100.000/giorno |
| CPU per richiesta | 10 ms |
| Durable Objects | disponibili **solo con backend SQLite** (è ciò che serve) |
| DO richieste | 100.000/giorno (include HTTP, RPC, messaggi WebSocket in ingresso con rapporto **20:1**, alarm) |
| DO durata | 13.000 GB-s/giorno |
| SQLite righe lette / scritte | 5.000.000 / 100.000 al giorno |
| SQLite spazio | 5 GB totali |
| Messaggi WS in uscita | non fatturati |
| Static Assets | file ≤ 25 MiB, ≤ 20.000 file per versione; richieste ad asset statici non consumano quota Worker |
| Reset quote | 00:00 UTC |

**Se i limiti gratuiti si esauriscono, le operazioni falliscono con errore: nessuna fatturazione automatica sul piano Free.** Non si attiva né serve il piano Paid.

## Stima
Con WebSocket Hibernation, 1 partita da 8 giocatori × ~60 azioni ≈ 500 messaggi ≈ 25 richieste fatturate (20:1) + connessioni. Decine di partite/giorno sono ampiamente entro quota; scrittura SQLite da tenere sotto controllo (1 scrittura di stato per azione, non per tick).

## Strategie
Hibernation API; nessun timer a polling (usare alarm solo per timeout); snapshot di stato compatti; cancellazione stanze terminate/inattive; gestione errore di quota con messaggio "servizio al limite giornaliero, riprova dopo 00:00 UTC"; contatori d'uso interni (nessun servizio di monitoraggio esterno).

## Stima di consumo del backend (Fase 4, misurata sul progetto)
- **Scritture SQLite**: 1 riga scritta per azione/cambio di stanza. Partita da 8 giocatori ≈ 160 azioni → ~160 righe scritte (limite gratuito 100.000/giorno → centinaia di partite).
- **Richieste Durable Object**: messaggi WebSocket in ingresso contano 1/20; ~160 azioni ≈ 8 richieste + connessioni + HTTP ≈ 30 per partita (limite 100.000/giorno).
- **Durata**: con WebSocket Hibernation il tempo di attesa tra azioni non fattura durata; i ping `{"t":"ping"}` sono risposti dal runtime senza svegliare la stanza.
- **Worker**: solo `/api/*` e `/ws/*` passano dal Worker; gli asset statici no (`run_worker_first` ristretto).
- **Pulizia**: stanze vuote/inattive cancellate (`deleteAll`) → nessun accumulo di dati.

## Chiusura delle stanze vuote (Worker)
- Lobby senza umani connessi: si chiude dopo 5 minuti dall'ultima disconnessione. Partita iniziata senza umani: 45 minuti (5 se un giocatore è uscito di sua volontà). Partita finita: 30 minuti. Vita massima di una stanza: 4 ore.
- I bot non agiscono se nessun umano è connesso e riprendono quando qualcuno torna.
- Una scadenza già passata non deve mai restare tra le sveglie (`nextAlarm`): rimetterebbe in moto la stanza ogni 50 ms. Due casi reali erano costati ~24.000 richieste ciascuno (host disconnesso in una lobby con bot; umano connesso e fermo in lobby oltre il limite). Test di regressione in `worker/tests/roomcore.test.ts`.
- Consumo misurato in simulazione: un'azione umana costa ~0,05 richieste (messaggi WebSocket 20:1); una sveglia dei bot costa 1 richiesta e copre le azioni di tutti i bot di quel momento.
