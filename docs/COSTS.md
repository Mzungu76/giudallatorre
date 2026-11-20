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
- **Scritture SQLite**: 1 riga scritta a ogni salvataggio dello stato (`out.persist`). Misura corretta il 2026-11-18: **~51 scritture per partita normale a 6, ~65 a 8, ~9 per una Flash** (la stima precedente, ~160 per 8 giocatori, contava le azioni e non i salvataggi). Vedi «Carico e scritture» sotto.
- **Richieste Durable Object**: messaggi WebSocket in ingresso contano 1/20; ~160 azioni ≈ 8 richieste + connessioni + HTTP ≈ 30 per partita (limite 100.000/giorno).
- **Durata**: con WebSocket Hibernation il tempo di attesa tra azioni non fattura durata; i ping `{"t":"ping"}` sono risposti dal runtime senza svegliare la stanza.
- **Worker**: solo `/api/*` e `/ws/*` passano dal Worker; gli asset statici no (`run_worker_first` ristretto).
- **Pulizia**: stanze vuote/inattive cancellate (`deleteAll`) → nessun accumulo di dati.

## Chiusura delle stanze vuote (Worker)
- Lobby senza umani connessi: si chiude dopo 5 minuti dall'ultima disconnessione. Partita iniziata senza umani: 45 minuti (5 se un giocatore è uscito di sua volontà). Partita finita: 30 minuti. Vita massima di una stanza: 4 ore.
- I bot non agiscono se nessun umano è connesso e riprendono quando qualcuno torna.
- Una scadenza già passata non deve mai restare tra le sveglie (`nextAlarm`): rimetterebbe in moto la stanza ogni 50 ms. Due casi reali erano costati ~24.000 richieste ciascuno (host disconnesso in una lobby con bot; umano connesso e fermo in lobby oltre il limite). Test di regressione in `worker/tests/roomcore.test.ts`.
- Consumo misurato in simulazione: un'azione umana costa ~0,05 richieste (messaggi WebSocket 20:1); una sveglia dei bot costa 1 richiesta e copre le azioni di tutti i bot di quel momento.


## Carico e scritture (misurati il 2026-11-18, dopo la moviola)

### Scritture SQLite per partita (simulazione con bot, `RoomCore`, 6 partite per tipo)
| Partita | Scritture oggi | Solo al cambio di fase | Al massimo una ogni 5 s |
|---|---|---|---|
| Flash, 4 giocatori | 9 | 7 (−22%) | ~2 (−78%) |
| Normale, 6 giocatori | 51 | 35 (−31%) | ~16 (−69%) |
| Normale, 8 giocatori | 65 | 44 (−32%) | ~20 (−69%) |

Con il limite gratuito di 100.000 righe scritte al giorno: **~1.900 partite normali (6 giocatori) o oltre 10.000 Flash al giorno**. La colonna «una ogni 5 s» è ottimistica (la simulazione fa un'azione ogni 1,5 s; nelle partite vere i tempi sono più lunghi).

**Decisione: non ridurre i salvataggi.** Il Worker usa WebSocket Hibernation: tra un messaggio e l'altro la stanza può uscire dalla memoria, quindi salvare meno spesso (al cambio di fase o con un ritardo) può far perdere un voto o un segnalino. Il guadagno (~30% sicuro) non vale il rischio. Da rivalutare solo se l'uso reale si avvicina al limite (prima valutare il piano Paid). Controllare le righe scritte al giorno nel pannello Cloudflare dopo la pubblicazione.

### Peso della moviola (`stereo.scene`)
- ~0,8 KB per turno; tetto di 24 scene (≈19 KB nel caso peggiore). Stato totale misurato: 19 KB (Flash), 27 KB (6 giocatori), 37 KB (8 giocatori), di cui scene 0,8 / 3,7 / 6,7 KB. Limite di una riga SQLite: 2 MB.
- Nessuna scrittura in più: cambia solo la dimensione della riga salvata.
- Rete: le scene si inviano ai client solo a partita finita (`viewFor`), non a ogni turno.
- Calcolo: l'intero conteggio dei luoghi comuni di un turno (luoghi comuni, scena, Pregiudiziometro) costa ~0,12 ms, contro il limite di 10 ms per richiesta.

### Prova di carico (`scripts/run-carico.sh`, Worker locale con wrangler/workerd)
Stanze Flash (1 umano che gioca con la sola vista ricevuta + 3 bot), ognuna da un IP diverso (la creazione è limitata a 10 al minuto per IP: voluto).
| | 60 stanze | 150 stanze |
|---|---|---|
| Partite finite | 60/60 | 150/150 |
| Risposta a un'azione (mediana / 99°) | 6 / 36 ms | 14 / 38 ms |
| Messaggio più grande | 6,4 KB | 6,7 KB |
| CPU workerd (media) | 13% di un core | 27% di un core |

Il ~185 s di una partita Flash è dovuto ai timer (30 s per fase), non al carico. Gli errori `WRONG_PHASE`/`ALREADY_DONE` sono azioni doppie inviate dallo script di prova (controlla ogni 40 ms), rifiutate correttamente dal server. I crash di workerd nel log compaiono solo allo spegnimento.

**Limiti della prova:** emulazione locale (non l'edge Cloudflare), solo Flash, un solo umano per stanza, nessuna partita normale a 6–8 giocatori (durano troppi minuti), memoria di workerd (~1,4 GB a 150 stanze) non confrontabile con i limiti di produzione. Per rifarla: `bash scripts/run-carico.sh "flash:60 flash:150"` (modo:stanze).
