# Ambiguità, contraddizioni e informazioni mancanti

Stato: **analisi su rev. 5.2l (provvisoria)**. Il regolamento definitivo NON è presente né nel repository né nella sessione (`/mnt/attach` vuota): va fornito prima di chiudere questo documento.

## RISOLTE (decisioni dell'utente, 2026-11-06)
| # | Decisione |
|---|---|
| B1 | Il regolamento definitivo è **`Giù dalla Torre! rev. 5.2l.pdf`** già nel repo (identico all'allegato) |
| B2 | Le carte Personaggio sono **125** (tutte le illustrazioni estratte; il regolamento che dice 100 è da considerarsi superato) |
| B3 | Carte a frase singola aggiunte in `Carte_singola frase.pdf` (vedi D1) |
| B4 | In caso di pareggio in testa **decide il Megafono**: se il suo voto è su una delle carte pari merito cade solo quella (le altre si salvano); se ha votato un'altra carta cadono tutte le pari merito. (Storia della regola: all'inizio cadeva sempre la carta del Megafono, poi restava su, poi cadevano tutte; scelta la versione "R2" dopo simulazioni, `tools/analysis/tie-mega.ts`.) |
| B5 | Il Megafono **può** votare la carta pescata dal mazzo |
| B6 | Si **può** votare la propria carta |
| B8 | Variante "Il Megafono sa": **sì**, opzione di stanza |

## ANCORA APERTE
| # | Tema | Domanda |
|---|------|---------|
| D1 | **Frasi** | Il regolamento prevede 70 carte Su sulla Torre (50 con 4 frasi + 20 singole). In repo: `Carte_frasi.docx` = 50 carte × **5** frasi (250); `Carte_singola frase.pdf` = **15** frasi singole (18 slot, 3 vuoti). Proposta: usare 50×5 e 15 singole così come sono (65 carte); mancano 5 singole: aggiungerle in futuro senza modifiche al codice |
| D2 | Carta "Su sulla Torre" a 5 frasi | Il Megafono ne sceglie una sola (come da regola per le carte multiple) — confermato implicitamente |
| D3 | Incipit | Le frasi del DOCX iniziano con "Oggi sale sulla torre…" (singolare, anche con "le persone che"): importate letteralmente, senza correzioni |
| D4 | Rotazione Megafono | Proposta: ordine di ingresso; giocatori disconnessi a lungo vengono saltati |
| D5 | Segnalino "Lui!" | Il Megafono sceglie quale dei due (CADE / NON CADE) usare; l'altro resta inutilizzato |

## MINORI
- Il Megafono non pesca a fine turno (non ha giocato carte; in variante "Megafono sa" pesca 1 carta come gli altri).
- Mazzo esaurito → si rimescola lo scarto.
- Refusi nel PDF (non riprodotti): "casualemente", "perdonaggi", "copertro", "scopertro".
- Il PDF delle carte non ha nomi: id = pagina+posizione (`pNN-iNN`). Quasi-duplicato `p01`/`p08` (diff 3.65): tenute entrambe; duplicato esatto p13-i01 escluso (125 immagini estratte, 124 file).
- Torre online dinamica: N carte (N = giocatori), non 45 caselle.

## Decisioni del 2026-11-06 (seconda tornata)
| Tema | Decisione |
|---|---|
| Lui! fallito | **Malus −1** al Megafono se la scommessa fallisce: CADE su un personaggio che non cade, oppure NON CADE su un personaggio che cade. I punteggi possono scendere sotto zero (assunzione: nessun limite inferiore — da confermare) |
| Parità finale | **Golden goal**: si continua a giocare turni (tutti i giocatori, anche quelli non in parità; il Megafono ruota come al solito) finché un solo giocatore ha più punti di tutti. Tetto di sicurezza: 30 turni extra, poi vittoria condivisa |
| Filtro frasi | Nessun filtro sulle frasi inventate dal Megafono; limite di lunghezza tecnico (80 caratteri) per proteggere l'interfaccia |
