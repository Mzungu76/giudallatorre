# Frasi del Megafono — regole (v5)

Sostituisce `REVISIONE_FRASI.md` (v2) e le frasi v4 di `content/su-sulla-torre.json`, che restano nello storico ma non sono più il mazzo di riferimento.

## Ruolo della frase
Il gioco nasce dal quesito «chi butteresti giù dalla torre tra questi?» e funziona anche senza frase. La frase dà **mordente**: rende la scelta più interessante, più divisiva e più discutibile. Il Megafono la usa anche come strumento di persuasione (guadagna punti per i voti che attira).

Una frase **non deve contenere per forza una colpa**. Deve far guardare i personaggi in modo diverso rispetto al voto senza frase.

## Regole (ricavate da tre giri di test con l'autore)
1. **Forma**: plurale o superlativo («i più…», «quelli che…») oppure un confronto semplice («chi sarebbe il peggior…»).
2. **Contenuto**: un tratto di carattere o una situazione ipotetica semplice, non un aneddoto.
3. **Chiarezza**: una clausola sola, comprensibile alla prima lettura ad alta voce.
4. **Universalità**: niente gergo o nicchie (social, fantacalcio, «k»).
5. **Positivo ribaltato**: ammesso, se il lato negativo è chiaro («i più generosi solo quando c'è pubblico»).
6. **Assurdo**: solo se si capisce al volo.
7. **Età**: ogni frase ha un campo `eta` (6+/10+/14+/18+). La stanza imposta la fascia d'età del gruppo e il mazzo si filtra.

Risultati dei test: confronti semplici, etichette al plurale/superlativo e tratti collettivi hanno tutti funzionato; aneddoti, abitudini di nicchia e assurdi complicati no.

## Mazzo
- **Tono per età**: dal 14+ in su le frasi sono più taglienti (tradimento, soldi, vizi, lutto); dal 18+ ci sono allusioni sessuali e umorismo nero, mai volgari né esplicite.
- **405 frasi** in `content/frasi-megafono.json`, come insieme (non più 50 carte da 4 frasi): 208 per 6+, 68 per 10+, 90 per 14+, 39 per 18+.
- **Pubblico di riferimento**: adulti e adolescenti. La fascia predefinita della stanza è **14+**.
- **Filtro cumulativo**: un gruppo con fascia N vede le frasi con età ≤ N (un gruppo 14+ pesca da 6+, 10+ e 14+; un gruppo 18+ da tutto).
- **Mano del Megafono**: 4 frasi pescate dall'insieme filtrato, di **famiglie diverse** (etichetta, collettivo, confronto, convinzione, ribaltato) per dare una vera scelta strategica.
- **Peso della pesca**: almeno 2 delle 4 frasi vengono dalle **due fasce più alte consentite** al gruppo, così le frasi 6+ (più miti) fanno da riempitivo e non da base.
- **Famiglie**: `etichetta`, `collettivo`, `confronto`, `convinzione`, `ribaltato`.
- **Stato** di ogni voce: `provata` (👍 nel test), `ritoccata` (riscritta dopo il test), `nuova` (da valutare).
- Il verbo («sale»/«salgono») è nel campo `verbo`: la frase completa è «Oggi {verbo} sulla torre {testo}».

## Confessioni («Ammetto che…»)
- **69 voci** in `content/confessioni.json` (15 originali riscritte in forma neutra + 54 nuove), di cui 14 per 14+ e 9 per 18+.
- Variante che coinvolge il giocatore: il Megafono si associa a uno dei personaggi sopra la Torre.
- **Nell'app la frase deve nominare il Megafono** (es. «Marco ammette di…»).
- Funziona bene con gruppi che si conoscono, con i bot dotati di carattere e di persona al tavolo; meno online tra sconosciuti.
- Tutte le confessioni sono in **forma neutra rispetto al genere** (niente participi al maschile o «con lui»); il controllo è nei test.

## Nell'app (fatto)
- L'app legge `content/frasi-megafono.json` e `content/confessioni.json` (le v4 sono in `content/storico/`).
- Opzioni di stanza **Pubblico** (fascia d'età, predefinita 14+) e **Confessioni**, scelte dall'host in lobby.
- Il server costruisce il mazzo all'avvio (`buildPhraseDeck`): 4 frasi di famiglie diverse per carta, almeno 2 dalle due fasce più alte consentite, confessioni in quota ~15%.
- La confessione mostra a tutti il nome del Megafono («Marco ammette…»).
- Test: duplicati, lunghezza, concordanza verbo/soggetto, forme di genere nelle confessioni, filtro per età, pesca pesata.

## Ancora da fare
- Curatela delle frasi con l'autore e prova a tavolo.
- Le frasi inventate dal Megafono (`free`) restano non filtrate per età.
