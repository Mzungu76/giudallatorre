# GAME_RULES — trasposizione tecnica (regolamento definitivo: rev. 5.2l)

> Fonte: `Giù dalla Torre! rev. 5.2l.pdf` (confermato definitivo dall'utente) + decisioni in `RULES_AMBIGUITIES.md`.

## Parametri
- Giocatori: **3–8**. Età 10+, ~20 min.
- Componenti: mazzo Personaggio (**125** carte, decisione utente), mazzo "Su sulla Torre" (70: 50×4 frasi + 20×1 frase, vedi B3), Torre, Megafono, 8 segnalini Voto, 8 dischetti giocatore, 2 segnalini "Lui!" (CADE / NON CADE).

## Setup
1. Mescola mazzo Personaggio e mazzo Su sulla Torre.
2. Ogni giocatore riceve **5 carte Personaggio** (mano privata), 1 segnalino voto.
3. Primo Megafono: casuale (o chi ha urlato per ultimo). Riceve Megafono + 2 "Lui!".

## Struttura
Ruoli per turno: **Megafono** (1) e **Folla** (tutti gli altri). Fasi: 1 Su sulla Torre → 2 Voto → 3 Giù dalla Torre → Fine turno.

### Fase 1 — Su sulla Torre
| Elemento | Regola |
|---|---|
| Condizione iniziale | Inizio turno; Megafono designato |
| Azione Megafono | Annuncia una frase che inizia con "Oggi sale/salgono sulla torre…": inventata, oppure da carta "Su sulla Torre". Carta a 4 frasi: ne sceglie 1; carta a 1 frase: **deve** dire quella. (Online: la frase è mostrata a tutti; il Megafono non digita, "proclama" a voce/megafono o sceglie dalla carta) |
| Carta del Megafono | (il Megafono può votarla) Pesca casualmente dal mazzo 1 carta Personaggio e la piazza coperta sulla Torre (non gioca dalla mano) — *variante "Il Megafono sa": gioca una carta dalla propria mano* |
| Azione Folla | Ogni giocatore della Folla sceglie in segreto 1 carta dalla mano e la gioca coperta |
| Risposta sistema | Quando tutte le carte sono giocate: mescola, rivela scoperte e numerate 1..N (N = n. giocatori) |
| Transizione | Tutte le carte scoperte → Fase 2 |

### Fase 2 — Voto
- Il Megafono piazza coperto **1 segnalino "Lui!"** (sceglie CADE o NON CADE) su un personaggio a sua scelta.
- **Tutti** (Megafono incluso) votano in segreto 1 personaggio sulla Torre.
- Transizione: tutti hanno votato → Fase 3.

### Fase 3 — Giù dalla Torre
1. Rivelazione voti (a partire dal giocatore successivo al Megafono; il Megafono per ultimo).
2. Cade il personaggio con più voti. **Pareggio: cadono insieme tutte le carte a pari merito**, anche quella votata dal Megafono. Chi ha votato una carta caduta fa +2, chi aveva giocato una carta caduta fa +2 (bonus carta, per ciascuna carta caduta).
3. Punti:
   - **+2** a chi ha votato il personaggio caduto;
   - **+2** a chi ha giocato la carta caduta;
   - Megafono: **+1 per ogni voto degli altri** sulla carta che ha votato, cada o no (il suo voto non conta; si somma, non si moltiplica);
   - Megafono, segnalino "Lui!": **CADE LUI! → +4** se il personaggio è caduto; **NON CADE LUI! → +1** se non è caduto. **Se la scommessa fallisce: −1** (decisione utente; i punteggi possono diventare negativi). Si somma agli altri punti.
4. Un giocatore può cumulare più bonus nel turno.

### Fine turno
- Voti tornano ai giocatori; carte rimaste sulla Torre → scarto.
- Ogni giocatore **tranne il Megafono** pesca 1 carta Personaggio (mano torna a 5; il Megafono non ha giocato carte).
- Mazzo esaurito → scarto rimescolato.
- Megafono + "Lui!" passano al giocatore alla **destra**.

## Fine partita
Termina quando tutti hanno fatto il Megafono: **1 volta (6–8 giocatori)**, **2 volte (3–5)**. Vince chi ha più punti. **Parità in testa → Golden goal**: si giocano turni extra (tutti i giocatori, Megafono a rotazione) finché un solo giocatore ha più punti di tutti (tetto di sicurezza 30 turni, poi vittoria condivisa). (Rounds extra possibili, sempre pari per tutti.)

## Discussione libera
Parlare è sempre consentito e non vincolante (bluff ammesso). **Vietato** rivelare la propria carta giocata prima del voto. Il Megafono "parla" solo con il megafono scenico. *(Online: regole sociali, non applicabili dal sistema; la chat testuale NON è inclusa salvo decisione.)*

## Implicazioni per il motore
Stato autorevole lato server; il client non decide punteggi, carte, esito voto, eliminazioni, vincitore. Le carte giocate e i voti restano segreti fino alla rivelazione.

## Decisioni aggiuntive
Si può votare la propria carta e quella del mazzo. Variante "Il Megafono sa" = opzione di stanza (il Megafono gioca dalla mano e ripesca).

## Scelte implementative del motore (Fase 3)
- Il motore parte con la partita già avviata (la lobby è del backend). Stato **serializzabile in JSON** e PRNG deterministico (`seed`): una partita è riproducibile e ripristinabile dopo un'interruzione.
- **Frase**: all'inizio del turno si pesca una carta "Su sulla Torre" visibile solo al Megafono. Può scegliere una frase della carta (carta singola: obbligatoria) oppure inventarla a voce (`free`). Mazzo frasi che si rimescola quando finisce.
- **Torre**: modalità base = N−1 carte giocate dalla Folla + 1 pescata dal mazzo (nessun proprietario); variante "Il Megafono sa" = N carte dalle mani. Le carte vengono mescolate e numerate 1..N solo quando tutti hanno giocato.
- **Voto**: tutti votano una volta, Megafono incluso, anche la propria carta e quella del mazzo.
- **Cade** la carta con più voti; in caso di **pareggio cadono insieme tutte le carte a pari merito**, anche quella votata dal Megafono.
- **Punti**: +2 a chi ha votato una carta caduta (Megafono compreso); +2 a chi ha giocato ciascuna carta caduta (nessuno se era del mazzo); **il Megafono prende inoltre 1 punto per ogni voto degli altri sulla carta che ha votato, sia che cada sia che resti su** (il suo voto non conta; i voti si sommano, non si moltiplicano); Lui! CADE sulla carta caduta +4; Lui! NON CADE su una carta che resta su +1; scommessa sbagliata −1. I punti si sommano.
- **Spoglio**: i voti escono uno alla volta, il Megafono per ultimo (suo gettone più grande); poi la carta più votata, il Lui! e il pannello "Chi prende punti": una riga per giocatore con i motivi (voto giusto, sua carta caduta, voti raccolti, Lui!) e il totale. I "+N" salgono dalle carte; la classifica del turno mostra l'operazione di ognuno.
- **Fine turno**: la Torre va nello scarto; pesca 1 carta chi ha giocato (la Folla; nella variante anche il Megafono); mazzo Personaggio rimescolato dallo scarto se finisce; il Megafono passa al giocatore successivo in ordine di ingresso.
- **Fine partita**: tutti hanno fatto il Megafono 2 volte (3–5 giocatori) o 1 volta (6–8). Vince il punteggio più alto, parità = vittoria condivisa.
- **Mazzo**: 125 carte Personaggio (decisione utente; la carta p13-i01 è identica a un'altra immagine ma resta una carta distinta).
- **Viste**: `viewFor(stato, giocatore)` è l'unico output verso i client: mano propria, proprietari della Torre e voti nascosti fino ai risultati, tipo di Lui! noto solo al Megafono.

## Voti raccolti dal Megafono (sostituisce il gregge)
Il Megafono incassa 1 punto per ogni voto degli altri sulla carta che ha votato, cada o no (es.: 3 voti degli altri = 3 punti; se la carta cade anche, +2 = 5). I voti sono segreti: il Megafono punta ad attirare voti (frase e Lui!), gli altri cercano di capire dove vota per non regalargli punti. La regola del gregge e la regola "il Megafono vince il pareggio" sono state tolte.

## Messaggi tra i giocatori
Chat di stanza (tasto 💬): messaggi fino a 140 caratteri, ultimi 60 conservati, limite di un messaggio ogni 0,7 s. Non c'è filtro sui contenuti. Gli schermi condivisi non vedono la chat.

## Mini-gioco di metà partita
Dopo il turno numero ⌊turni totali / 2⌋ (arrotondato per difetto) si gioca **un solo mini-gioco**, scelto a caso tra tre. Non c'è il Megafono né il Lui!. Prima c'è un **intervallo** (suono, schermata speciale con il nome del gioco e cosa fare, si chiude con un pulsante). Tutte le mani vengono **rinnovate** (5 carte nuove a tutti; le vecchie vanno nello scarto). Tutti i giocatori giocano una carta, le carte salgono sulla torre e si vota in segreto; **si può votare anche la propria carta**. Dopo il mini-gioco ognuno pesca una carta e si riprende con il turno successivo.

- **L'Accusa** — una carta pescata a caso (l'accusatore, mostrata a parte e non votabile) accusa uno dei giocatori di una marachella (50 accuse). Ognuno gioca il colpevole.
- **La storia d'amore** — una carta pescata a caso (il protagonista, mostrata a parte) ha una nuova storia d'amore: ognuno gioca il partner ideale.
- **Il raccomandato** — nessuna frase né accusa: si vota chi buttare giù.

**Punteggio di Accusa e Storia d'amore.** Restano sulla torre le carte con più voti (tutte quelle a pari merito); le altre **cadono**. Chi ha votato una carta in testa prende **tanti punti quanti sono i voti su quella carta (compreso il proprio)**; chi ha giocato una carta in testa prende il **doppio dei voti** ricevuti. Chi ha votato una carta caduta, e chi ha giocato una carta caduta, non prende nulla. Se tutte le carte hanno gli stessi voti non cade nessuna.

**Punteggio del Raccomandato.** Cade la carta più votata (o tutte quelle a pari merito in testa). Chi ha giocato una carta caduta **perde tanti punti quanti sono i voti ricevuti**, senza scendere sotto zero. I votanti non prendono nulla.

**Tetto.** Nei mini-giochi con punti positivi nessun giocatore guadagna più di `max(N, 2 × turni ancora da giocare)` punti (N = giocatori): il bonus si autoregola sulla lunghezza della partita e la seconda metà resta aperta.

Bot: sono un po' imprevedibili (voto e scelta della carta a probabilità).
