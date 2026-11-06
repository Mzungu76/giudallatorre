# Ambiguità, contraddizioni e informazioni mancanti

Stato: **analisi su rev. 5.2l (provvisoria)**. Il regolamento definitivo NON è presente né nel repository né nella sessione (`/mnt/attach` vuota): va fornito prima di chiudere questo documento.

## BLOCCANTI (modificano il gioco)

| # | Tema | Fonti in conflitto | Domanda |
|---|------|--------------------|---------|
| B1 | **Regolamento definitivo mancante** | Il prompt lo dà "allegato", ma non è arrivato | Puoi ricaricarlo (nel repo o in chat)? |
| B2 | **Numero carte Personaggio** | Regolamento: 100. PDF illustrazioni: 14 pagine, **125 immagini** (124 uniche esatte; 1 duplicato identico p12/p13; 1 quasi-duplicato p1/p8) | Quante e quali sono le carte vere? Quelle in eccesso sono bozze/varianti? Quale versione tenere per il quasi-duplicato? |
| B3 | **Carte "Su sulla Torre"** | Regolamento: 70 carte = 50 da 4 frasi + 20 da 1 frase. DOCX: titolo "50 carte x 5 frasi" = 250 frasi, nessuna carta da 1 frase | Il definitivo usa 5 frasi o 4? Dove sono le 20 carte da 1 frase ("Ammetto che sono stato più volte in vacanza con uno dei personaggi...") e le 4 frasi del regolamento (formula "Oggi salgono sulla torre i parteciponi...")? Le frasi del DOCX hanno incipit "Oggi sale sulla torre chi…", diverso dal regolamento |
| B4 | **Pareggio nei voti** | "In caso di pareggio cade il personaggio votato dal Megafono, anche se ha ricevuto meno voti" | Se il Megafono ha votato un personaggio NON coinvolto nel pareggio, quale cade? (Il Megafono vota tramite segnalino voto, distinto dal "Lui!".) Proposta: cade il personaggio *tra i pareggiati* votato dal Megafono; se non c'è, estrazione casuale. Da confermare |
| B5 | **Carta del Megafono (fase 1)** | Pescata casualmente dal mazzo e messa sulla Torre; quindi sulla Torre ci sono N-1 carte della Folla + 1 del mazzo = N carte | Il Megafono **può votare** il personaggio pescato dal mazzo? E chi "ha giocato" quella carta (nessuno) non fa punti — confermare |
| B6 | **Giocatore che vota la propria carta** | Non specificato | È consentito votare la carta che si è giocata? Proposta: sì, è permesso |
| B7 | **Fine partita: "tutti hanno fatto il Megafono 1 volta (6-8) o 2 volte (3-5)"** | Ordine "alla destra in ordine di turno" | Verso/ordine di rotazione in online: proposta ordine di ingresso. Giocatori espulsi/disconnessi definitivamente a metà partita? |
| B8 | **Variante "Il Megafono sa"** | Opzionale | Implementarla come opzione di stanza? (Proposta: sì, flag alla creazione) |
| B9 | **Segnalini "Lui!"** | Ne servono 2 ("CADE" e "NON CADE"); il Megafono ne usa uno solo | Il Megafono *sceglie* quale dei due usare vedendo il retro (ovvio dal testo) — confermare che l'altro resta inutilizzato |
| B10 | **Punti "NON CADE LUI!"** | +1 se il segnalino sta su un personaggio che non cade | Confermato testo; ma con N carte la probabilità è alta: bilanciamento voluto? (solo informativo) |

## MINORI (propongo la soluzione indicata)

- Mano di 5 carte, ripescata a fine turno: il Megafono non pesca (ha già la mano intera). OK dal testo.
- Mazzo personaggi esaurito → si rimescola lo scarto (testo chiaro). Se mazzo+scarto insufficienti (impossibile con ≥100 carte, 8 giocatori).
- Refusi nel PDF rev. 5.2l ("casualemente", "perdonaggi", "copertro", "Lato scopertro", "Gran Megafono" nel testo vittoria): da non riprodurre.
- Contraddizione grafica: tavolo di setup "Segnalino Voto" numerato 1–8 e Plancia con caselle 1–45: la Torre online è dinamica (N ≤ 8 carte).
- Voto "in ordine di turno a partire dal successivo al Megafono": online le rivelazioni sono simultanee con animazione in ordine (nessun effetto sul punteggio).
- Frasi/carte con **Carte_frasi.docx**: 250 frasi uniche, nessun duplicato; tabella riepilogativa a fine documento (50 temi) importata solo come `tema`.
- Il PDF delle carte non contiene nomi: l'unico identificativo certo è pagina+posizione (`pNN-iNN`). Il rapporto frase↔carta Personaggio non esiste (le frasi non sono legate a singoli personaggi).
