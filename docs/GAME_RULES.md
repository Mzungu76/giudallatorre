# GAME_RULES — trasposizione tecnica (regolamento definitivo: rev. 5.2l)

> Fonte: `Giù dalla Torre! rev. 5.2l.pdf` (confermato definitivo dall'utente) + decisioni in `RULES_AMBIGUITIES.md`.

## Parametri
- Giocatori: **3–8**. Età 10+, ~20 min.
- Componenti: mazzo Personaggio (**125** carte, decisione utente), mazzo frasi del Megafono (riserva di 405 frasi + 69 confessioni, filtrata per età: vedi `docs/FRASI_MEGAFONO.md`), Torre, Megafono, 8 segnalini Voto, 8 dischetti giocatore, 2 segnalini "Lui!" (CADE / NON CADE).

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
| Azione Megafono | Annuncia una frase che inizia con "Oggi sale/salgono sulla torre…": inventata, oppure da carta "Su sulla Torre". Carta a più frasi (ora 3): ne sceglie 1; carta a 1 frase: **deve** dire quella. (Online: la frase è mostrata a tutti; il Megafono non digita, "proclama" a voce/megafono o sceglie dalla carta) |
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
2. Cade il personaggio con più voti. **Pareggio: decide il Megafono** — se ha votato una delle carte pari merito cade solo la sua (le altre si salvano), altrimenti cadono insieme tutte le pari merito. Chi ha votato una carta caduta fa +2, chi aveva giocato una carta caduta fa +2 (bonus carta, per ciascuna carta caduta).
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
Termina quando tutti hanno fatto il Megafono: **2 volte con 3 giocatori (6 turni)**, **1 volta con 4–8 giocatori (tanti turni quanti i giocatori)**. Vince chi ha più punti. **Parità in testa → Golden goal**: si giocano turni extra (tutti i giocatori, Megafono a rotazione) finché un solo giocatore ha più punti di tutti (tetto di sicurezza 30 turni, poi vittoria condivisa). (Rounds extra possibili, sempre pari per tutti.)

## Discussione libera
Parlare è sempre consentito e non vincolante (bluff ammesso). **Vietato** rivelare la propria carta giocata prima del voto. Il Megafono "parla" solo con il megafono scenico. *(Online: regole sociali, non applicabili dal sistema; la chat testuale NON è inclusa salvo decisione.)*

## Implicazioni per il motore
Stato autorevole lato server; il client non decide punteggi, carte, esito voto, eliminazioni, vincitore. Le carte giocate e i voti restano segreti fino alla rivelazione.

## Decisioni aggiuntive
Si può votare la propria carta e quella del mazzo. Variante "Il Megafono sa" = opzione di stanza (il Megafono gioca dalla mano e ripesca).

## Scelte implementative del motore (Fase 3)
- Il motore parte con la partita già avviata (la lobby è del backend). Stato **serializzabile in JSON** e PRNG deterministico (`seed`): una partita è riproducibile e ripristinabile dopo un'interruzione.
- **Frase**: all'inizio dell'avvio il server costruisce il mazzo della stanza dalla riserva, filtrato per la **fascia d'età** scelta dall'host (6+/10+/14+/18+, predefinita 14+): carte da **3 frasi di famiglie diverse** (almeno 2 delle due fasce più alte consentite) e, se attive, carte-**confessione** a frase singola (~15%). Il Megafono vede la carta e sceglie una frase (confessione: obbligatoria) oppure la inventa (`free`). Una confessione è letta in prima persona dal Megafono; a tutti l'app mostra «Nome ammette…». Mazzo che si rimescola quando finisce.
- **Torre**: modalità base = N−1 carte giocate dalla Folla + 1 pescata dal mazzo (nessun proprietario); variante "Il Megafono sa" = N carte dalle mani. Le carte vengono mescolate e numerate 1..N solo quando tutti hanno giocato.
- **Voto**: tutti votano una volta, Megafono incluso, anche la propria carta e quella del mazzo.
- **Cade** la carta con più voti; in caso di **pareggio decide il Megafono**: se ha votato una delle carte pari merito cade solo la sua, le altre si salvano; se ha votato un'altra carta cadono tutte le pari merito. Il suo gettone di voto ha un simbolo "=" che lampeggia e si illumina quando usa questo bonus.
- **Punti**: +2 a chi ha votato una carta caduta (Megafono compreso); +2 a chi ha giocato ciascuna carta caduta (nessuno se era del mazzo); **il Megafono prende inoltre 1 punto per ogni voto degli altri sulla carta che ha votato, sia che cada sia che resti su** (il suo voto non conta; i voti si sommano, non si moltiplicano); Lui! CADE sulla carta caduta +4; Lui! NON CADE su una carta che resta su +1; scommessa sbagliata −1. I punti si sommano.
- **Spoglio**: i voti escono uno alla volta, il Megafono per ultimo (suo gettone più grande); poi la carta più votata, il Lui! e il pannello "Chi prende punti": una riga per giocatore con i motivi (voto giusto, sua carta caduta, voti raccolti, Lui!) e il totale. I "+N" salgono dalle carte; la classifica del turno mostra l'operazione di ognuno.
- **Fine turno**: la Torre va nello scarto; pesca 1 carta chi ha giocato (la Folla; nella variante anche il Megafono); mazzo Personaggio rimescolato dallo scarto se finisce; il Megafono passa al giocatore successivo in ordine di ingresso.
- **Fine partita**: tutti hanno fatto il Megafono 2 volte (3 giocatori) o 1 volta (4–8). Vince il punteggio più alto, parità = vittoria condivisa.
- **Mazzo**: 125 carte Personaggio (decisione utente; la carta p13-i01 è identica a un'altra immagine ma resta una carta distinta).
- **Viste**: `viewFor(stato, giocatore)` è l'unico output verso i client: mano propria, proprietari della Torre e voti nascosti fino ai risultati, tipo di Lui! noto solo al Megafono.

## Voti raccolti dal Megafono (sostituisce il gregge)
Il Megafono incassa 1 punto per ogni voto degli altri sulla carta che ha votato, cada o no (es.: 3 voti degli altri = 3 punti; se la carta cade anche, +2 = 5). I voti sono segreti: il Megafono punta ad attirare voti (frase e Lui!), gli altri cercano di capire dove vota per non regalargli punti. La regola del gregge e la regola "il Megafono vince il pareggio" sono state tolte.

## Messaggi tra i giocatori
Chat di stanza (tasto 💬): messaggi fino a 140 caratteri, ultimi 60 conservati, limite di un messaggio ogni 0,7 s. Non c'è filtro sui contenuti. Gli schermi condivisi non vedono la chat.

## Mini-gioco (intervallo)
**Fino a 5 giocatori** c'è **un intervallo** dopo il turno ⌊turni totali / 2⌋ (3 giocatori: dopo il turno 3; 4 e 5: dopo il turno 2). **Da 6 a 8 giocatori** ce ne sono **due**, dopo i turni ⌊totali / 3⌋ e ⌊2 × totali / 3⌋ (6 e 7 giocatori: dopo i turni 2 e 4; 8 giocatori: dopo i turni 2 e 5). Ogni intervallo è un mini-gioco scelto a caso tra tre, e **i due di una partita sono sempre diversi**. Non c'è il Megafono né il Lui!. Prima c'è un **intervallo** (suono, schermata speciale con il nome del gioco e cosa fare, si chiude con un pulsante). All'inizio dell'intervallo **la mano di ognuno è sostituita per intero** (5 carte nuove; le vecchie vanno nello scarto): quando il giocatore apre la scelta della carta nell'intervallo, l'app lo mostra con un'animazione (si parte dal vuoto, compare un mazzetto coperto che si scopre, scritta «Rinnoviamo la tua mano!» che scompare alla fine). Tutti giocano una carta della mano nuova, le carte salgono sulla torre e si vota in segreto; **si può votare anche la propria carta** (tranne nel Peggiore). Dopo il mini-gioco ognuno pesca una carta e si riprende con il turno successivo.

- **L'Accusa** — una carta pescata a caso (l'accusatore, mostrata a parte e non votabile) accusa **un altro personaggio** di una marachella (50 accuse, scritte in prima persona dall'accusatore). Ognuno gioca in segreto il personaggio che l'avrebbe fatta: il colpevole.
- **La storia d'amore** — una carta pescata a caso (il protagonista, mostrata a parte) ha una nuova storia d'amore: ognuno gioca il partner ideale.
- **Il peggiore** — nessuna frase né accusa. Ognuno gioca in segreto il personaggio che per lui è il **peggiore in assoluto**, poi tutti votano la carta che deve cadere, **tranne la propria** (non si può votare: l'app la blocca, il motore rifiuta il voto).

**Chi cade.** *Accusa*: cade la carta **più votata**, il colpevole (a pari merito cadono tutte quelle in testa; se tutte le carte hanno gli stessi voti non cade nessuna). *Storia d'amore*: restano le carte con più voti e cadono le altre (il partner perfetto non cade). *Peggiore*: cadono le più votate.

**Punteggio di Accusa e Storia d'amore.** Uguale nei due giochi: chi ha votato una carta in testa prende **tanti punti quanti sono i voti su quella carta (compreso il proprio)**; chi ha giocato una carta in testa prende **+2**. Chi ha votato una carta non in testa, e chi ha giocato una carta non in testa, non prende nulla. **Nessun punto si perde mai in un intervallo e non c'è nessun tetto.**

**Punteggio del Peggiore.** Cade la carta più votata (o tutte quelle a pari merito in testa), come in un turno normale. **+2** a chi ha votato una carta caduta (voto giusto, come nei turni) e **+1 per ogni voto ricevuto** dalla carta che si è giocata, cada o no (al massimo N−1 voti, perché non ci si vota: in un intervallo si possono fare al massimo N+1 punti). Nessun punto si perde.

**Come si fanno punti, in app.** La schermata di presentazione di ogni intervallo ha il riquadro «Come si fanno punti» con le regole di quel gioco (Accusa e Storia d'amore: voti sulla carta in testa e +2 se è la propria; Peggiore: +2 se voti una carta che cade, +1 per ogni voto alla propria carta).

**Spoglio dell'intervallo.** Come nei turni normali: i voti compaiono **uno alla volta** (chi ha votato cosa, l'ultimo con un po' di suspense), poi il più votato / le carte in testa, poi la caduta e il riepilogo dei punti. «Avanti ›» e «Salta ›» come nei turni.

Bot: sono un po' imprevedibili (voto e scelta della carta a probabilità).

## Segnalini Lui! (sostituiscono "Cade lui / Non cade")
Ogni partita ha **2 segnalini Lui!**, uguali per tutti i giocatori: **sempre lo 0** (altrimenti, con una soglia, nessuno voterebbe mai la carta del Lui!) più **una soglia a caso** dal pool adatto al numero di giocatori. Ognuno si usa **una volta sola**. Ogni giocatore vede sempre i **propri** segnalini (accanto al suo nome, quelli spesi sono grigi); **quelli degli altri non si vedono** e vanno ricordati. Quando è Megafono, il giocatore posa uno dei suoi gettoni, coperto, su una carta e scommette sul **numero di voti che la carta riceve dagli ALTRI** (il voto del Megafono non conta). "k voti" riesce con **almeno k** voti degli altri; lo **0** riesce solo se **nessun altro** vota la carta. Se riesce, il Megafono incassa i punti stampati; se no, niente (nessun malus, ma il gettone è speso). Finiti i gettoni (spareggio) tornano tutti.

I punti stampati sono **tarati sulla probabilità di riuscita** (simulazioni con i bot, `tools/analysis/lui-pool.ts`): più il segnalino è difficile, più paga.

| Giocatori | Pool (gettone → punti) |
|---|---|
| 3 | 0 → 5 · almeno 1 → 4 · almeno 2 → 10 |
| 4 | 0 → 5 · almeno 1 → 4 · almeno 2 → 7 · almeno 3 → 16 |
| 5–8 | 0 → 5 · almeno 1 → 4 · almeno 2 → 7 · almeno 3 → 14 |

Il Megafono per il resto fa punti come gli altri: +2 se vota una carta che cade (e +2 se cade la carta che ha giocato nella variante "Il Megafono sa"). Spariscono "Cade lui!/Non cade", il malus −1 e il +1 per voto raccolto.

**Bot.** Il Megafono bot sceglie gettone e carta con il valore atteso (voti simulati dalla stima del gruppo) in modo imprevedibile. I bot non Megafono vedono il Lui! su una carta ma non il numero né quali gettoni gli restano: stimano quale dei due gettoni ha usato e quanto il proprio voto su quella carta gli regala (soglie) o gli toglie (lo 0), e lo pesano nella scelta (Difficile di più).

## Variante «Il gregge» (in prova, opzione di stanza)
L'host la attiva nella lobby (casella «Il gregge (prova)»; di serie è spenta). Cambia **solo il segnalino 0**:
- I segnalini restano 2 per partita: **sempre lo 0** più **una soglia a caso** dal pool per numero di giocatori (come sopra).
- **Lo 0 è l'Imbroglio!**: i voti di chi vota la sua carta **non valgono**, come se non esistessero. La maggioranza (e l'eventuale pareggio) si calcola solo con i voti validi, quindi la carta dell'Imbroglio! non cade mai (il Megafono non può votarla). Chi ha votato la carta non prende il +2 del voto giusto ma tiene gli altri punti (es. la propria carta caduta). Se l'Imbroglio! annulla **almeno un voto**, il Megafono prende **+3** (valore tarato con i bot: `tools/analysis/imbroglio.ts`); se nessuno vota la carta, niente.
- **Il Megafono non può votare la carta su cui ha posato il Lui!** (Imbroglio! o soglia). Se in app la tocca durante il voto, il pannello gli dice «Non puoi votare la carta dove hai posato il Lui!: scegline un'altra»; il motore rifiuta comunque il voto.
- **La soglia** riesce come nella partita normale (la carta riceve almeno k voti dagli altri, che cada o no), e i punti stampati vanno **al Megafono (che non può votarla) e a tutti quelli che hanno votato quella carta**. Soglia mancata: niente a nessuno. Sul gettone c'è il simbolo 🗳 (i punti vanno a chi vota).
- In app il gettone dell'Imbroglio! è grigio scuro con «0 VOTI», 🚫 in alto e la stella «+3». Lo spoglio resta lo stesso (voti, conteggio, Lui!): il conteggio usa già solo i voti validi e, quando si scopre l'Imbroglio!, i voti annullati spariscono dalla Torre. Nel riepilogo chi l'ha votata ha «Voto annullato dall'Imbroglio!».
- **Estrazione a inizio partita**: dopo la schermata del personaggio, ogni giocatore vede l'estrazione della soglia (componente `LuiDraw`): una carrellata dei segnalini soglia possibili per quel numero di giocatori che rallenta e si ferma su quello della partita («Esce: …!»), poi arriva accanto l'Imbroglio! e si vede il set della partita con la spiegazione dei due gettoni. Si può saltare; compare una volta sola per stanza (non con la modalità veloce né sugli schermi condivisi). La soglia è già estratta dal server all'avvio: l'animazione la mostra soltanto.
- Motore: `GameConfig.gregge`; il segnalino ha `trap: true`, `k: 1` e `pts: 3` (`IMBROGLIO_PTS`); l'esito (`LuiOutcome`) riporta `trap` e `caught` (chi l'ha votata); i voti di `caught` sono esclusi da `counts`. Soglia: il segnalino ha `herd: true`; se riesce, `shared` elenca chi ha votato la carta e prende i punti (riga `lui` per il Megafono, `lui-gregge` per chi l'ha votata). `luiForbidden(stato, giocatore)` dice quale carta il giocatore non può votare.
- Bot (Medio e Difficile): ragionano sul **vantaggio rispetto agli altri** (i propri punti meno la media di quelli degli avversari), non sui soli punti propri: raggiungere una soglia che premia anche il Megafono e gli altri che votano la carta conviene solo se il mio voto non è quello decisivo. Il **Megafono** sceglie prima il gettone e poi la carta in modo imprevedibile (bluff: non sempre il gettone che rende di più, non sempre la carta più votata) e mette in conto quanto la carta del Lui! attira i voti: chi vota non vede il gettone, quindi reagisce allo stesso modo ai due (se la soglia è attraente, la carta del Lui! attira, e lì l'Imbroglio! rende). **Chi vota** stima quale gettone è dai gettoni rimasti al Megafono, da quanto spesso è uscito l'Imbroglio! negli spogli già visti e da un'idea "sfocata" di come ragiona il Megafono, con un po' di dubbio. Ogni bot ha un **carattere** fisso (più diffidente o più fiducioso; da Megafono più o meno bluffone), così non vanno tutti nella stessa direzione. Misura: `npx tsx tools/analysis/gregge-bots.ts hard 40`.

## Spiegazione del Lui! sulla Torre (tutte le versioni)
Durante il voto, toccando il gettone Lui! posato su una carta si apre un popup che spiega in breve come funziona: agli altri mostra i 2 gettoni della partita («può essere uno di questi», senza dire quale), al Megafono quello che ha posato. I testi seguono la variante (normale o «Il gregge»).

## Uscire dalla partita
Un giocatore umano può uscire in qualsiasi momento (Regolamento «i» → «Esci dalla partita», con conferma). Se nella stanza restano **altri umani** (anche temporaneamente offline), un **giocatore virtuale di livello medio** prende il suo posto: stessa posizione, stessi punti e stessa mano, e gli altri vedono un avviso. Se chi esce era l'host, il ruolo passa a un altro umano. Se **non restano umani**, la stanza si chiude subito. Il vecchio accesso non è più valido.
