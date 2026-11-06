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
