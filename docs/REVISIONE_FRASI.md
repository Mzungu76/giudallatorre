> **Aggiornamento (v2):** le 250 frasi delle 50 carte sono state **riscritte** (comportamenti umani buffi e irriverenti, pensati per i tipi umani dei personaggi). Quelle del documento originale restano nel campo `frasi_originali` di `content/su-sulla-torre.json`. Le 15 frasi singole ("Ammetto…") non sono cambiate. Questo documento descrive la revisione precedente.

# Revisione delle frasi — proposta (nessuna frase è stata ancora modificata)

Fonti: `Carte_frasi.docx` (50 carte × 5 frasi) e `Carte_singola frase.pdf` (15 frasi singole). I file originali restano intatti: le correzioni, se approvate, vanno in `content/` e si ricostruiscono con uno script, mantenendo lo storico.

## A. Correzioni grammaticali certe (propongo di applicarle subito)
1. **Plurale con «sale»** — 50 frasi («Oggi sale sulla torre le persone che…»). Il regolamento dice «Oggi **sale/salgono** sulla torre…»: per le frasi plurali basta usare **«Oggi salgono sulla torre le persone che…»**. Interessa la 3ª frase di ogni carta (tutte e 50 iniziano con «le persone che / arrivate / a cui / in / con»).
2. **Frasi singole** (15): punteggiatura e maiuscole incoerenti.
   - Mancano i punti finali in 6 frasi (n. 4, 8, 9, 10, 13 e parte della 14 rimane con punto).
   - «Ammetto**,** di essere cugino/cugina…»: virgola di troppo (n. 3).
   - «sopra alla torre» (n. 4) → «sopra la Torre» come le altre; «ad uno scherzo» → «a uno scherzo» (n. 15).
   - «Torre» maiuscola nelle singole, «torre» minuscola nelle altre: scegliere una regola (propongo «Torre» solo per il nome proprio nel titolo, minuscolo nelle frasi).
3. **Accordo di genere** nelle singole: «essermi infiltrato», «stato», «rimasto… con lui» sono al maschile; chi gioca può essere una donna. Propongo forme neutre («Ammetto di aver…» dove possibile) oppure scelta automatica dal nickname non attendibile: meglio riformulare.

## B. Da decidere con te (contenuto)
Trovati leggendo tutte le 250 frasi.
- **Ripetizioni di gag** tra carte diverse: «in pigiama» (4 frasi), «telecomando» (3), «audio/vocali» (3), «occupa due posti / tavolo» (5), «saluta col nome/cognome sbagliato» (2), «condivide lo schermo» (2), «niente social» (2), «contando i centesimi» (2).
- **Frasi poco chiare** che rallentano il gioco: «chi sbaglia il PIN… la propria data», «chi porta in cantina… per sempre», «chi legge il manuale… dopo», «chi dà croccantini… al telecomando», «le persone a cui avanzano metà dei pezzi», «chi suona al citofono di sé stesso».
- **Toni da valutare per età 10+**: «coltello a serramanico» (c. 38), «chi fuma sul pianerottolo» (c. 39), «chi fa stories ai funerali» (c. 28), «chi parla al telefono in bagno» (c. 36).
- **Puntini di sospensione** nel mezzo della frase («chi riporta il carrello… in mezzo al parcheggio»): ritmo da battuta, ma leggendo a voce spesso confondono; ~35 frasi.
- **Lunghezza**: la più lunga è 94 caratteri; sono tutte leggibili, ma sullo schermo piccolo le più lunghe occupano 3 righe.
- **Struttura**: 200 frasi iniziano con «chi», 50 con «le persone»: poca varietà sintattica rispetto al regolamento, che prevede anche personaggi per categorie («quelli che…», «i/le…»).

## C. Come lavorare (proposta)
1. Applico subito la sezione A (modifiche meccaniche, elencate in un file di differenze).
2. Per la sezione B ti preparo un foglio con ogni frase segnalata e **2 alternative** per ciascuna; scegli tu (oppure confermi l'originale).
3. Una sola fonte di verità: `content/su-sulla-torre.json` (+ script che segnala frasi duplicate o fuori regola nei test).
