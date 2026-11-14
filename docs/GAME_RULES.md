# GAME_RULES — trasposizione tecnica (regolamento definitivo: rev. 5.2l)

> Fonte: `Giù dalla Torre! rev. 5.2l.pdf` (confermato definitivo dall'utente) + decisioni in `RULES_AMBIGUITIES.md`.

## Gioco base attuale: «Cade / Non cade» (dal 2026-11-10)
È **l'unica** partita dell'app: le varianti precedenti (segnalini Lui! 0/soglia, «Il gregge», PROPAGANDA, obiettivi, Megafono che non gioca carte) e la modalità al tavolo sono state rimosse dal motore e dal prodotto.

1. **«Il Megafono sa» sempre attivo**: il Megafono sceglie la frase e poi gioca una carta dalla mano come gli altri (poi ripesca). Sulla Torre ci sono N carte, ognuna di un giocatore; ognuno conosce solo la propria.
2. **Segnalino**: il Megafono ha a ogni turno tutti e tre i segnalini (tornano disponibili) e quando le carte sono salite ne posa **uno solo**, coperto, su una carta (anche la sua): **CADE**, **NON CADE** o **VOTI NULLI!**. Gli altri vedono dove, non quale; si scopre a fine turno. Nessun malus. (Dal 2026-11-10 al primo test erano 2 per turno: troppo carico da gestire.)
3. **Voto**: tutti votano in segreto, anche la propria carta o una segnata; **il Megafono non può votare la carta con VOTI NULLI!** (così resta sempre almeno un voto valido).
4. **Conteggio**: i voti sulla carta con VOTI NULLI! non valgono. Cade la più votata. **Pareggio**: se tra le pari c'è la carta con CADE cade solo lei, altrimenti cadono tutte; il voto del Megafono non ha ruolo speciale.
5. **Punti**: +2 a chi vota una carta che cade (voto valido); +2 a chi l'ha giocata (Megafono compreso). **CADE**: se la carta cade, +4 al Megafono (ovunque abbia votato, una volta sola) e +4 a ognuno della Folla che l'ha votata. **NON CADE**: se la carta resta su, +2 al Megafono e +2 a ognuno della Folla che l'ha votata. **VOTI NULLI!**: nessun punto; chi l'ha votata perde il +2.
6. Le stesse regole valgono con 3 giocatori. Analisi: `tools/analysis/tre-giocatori*.ts`.

In app: il Megafono tocca una carta e sceglie il segnalino; se al voto tocca la carta con VOTI NULLI!, il pannello lo avvisa. Allo spoglio (invariato) il segnalino si scopre con una frase e i voti annullati spariscono dalla Torre; nel pareggio deciso dal CADE il conteggio dice solo che «lo scioglie il segnalino del Megafono».

## Parametri
- Giocatori: **3–6**. Età 10+, ~20 min.
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
Termina quando tutti hanno fatto il Megafono: **2 volte con 3 giocatori (6 turni)**, **1 volta con 4–6 giocatori (tanti turni quanti i giocatori)**. Vince chi ha più punti. **Parità in testa → Golden goal**: si giocano turni extra (tutti i giocatori, Megafono a rotazione) finché un solo giocatore ha più punti di tutti (tetto di sicurezza 30 turni, poi vittoria condivisa). (Rounds extra possibili, sempre pari per tutti.)

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
- **Spoglio** (solo immagini): i gettoni dei votanti cadono uno alla volta sulle carte, senza conteggi né pallini; prima del voto del Megafono pausa di suspense di 1,5 s con rullo di tamburo; poi si gira il segnalino Lui! (colpo di tamburo + squillo). Infine la fila davanti scende un po' (più spazio sulle carte dietro), le carte che cadono si abbassano con la freccia rossa e compaiono i riquadri dei punti (uno alla volta con popup, il Megafono per ultimo, sulle carte e in basso) e si aspetta il tocco su «Gettalo/Gettali dalla torre!» (plurale se cadono più carte): si analizzano i voti con calma. Solo sullo schermo condiviso si prosegue da soli dopo 40 s. Segue la caduta; i punti compaiono dopo, uno alla volta con popup (il Megafono per ultimo). ⏭ salta al passo successivo, «Salta» chiude tutto.
- **Fine turno**: la Torre va nello scarto; pesca 1 carta chi ha giocato (la Folla; nella variante anche il Megafono); mazzo Personaggio rimescolato dallo scarto se finisce; il Megafono passa al giocatore successivo in ordine di ingresso.
- **Fine partita**: tutti hanno fatto il Megafono 2 volte (3 giocatori) o 1 volta (4–6). Vince il punteggio più alto, parità = vittoria condivisa.
- **Mazzo**: 125 carte Personaggio (decisione utente; la carta p13-i01 è identica a un'altra immagine ma resta una carta distinta).
- **Viste**: `viewFor(stato, giocatore)` è l'unico output verso i client: mano propria, proprietari della Torre e voti nascosti fino ai risultati, tipo di Lui! noto solo al Megafono.

## Voti raccolti dal Megafono (sostituisce il gregge)
Il Megafono incassa 1 punto per ogni voto degli altri sulla carta che ha votato, cada o no (es.: 3 voti degli altri = 3 punti; se la carta cade anche, +2 = 5). I voti sono segreti: il Megafono punta ad attirare voti (frase e Lui!), gli altri cercano di capire dove vota per non regalargli punti. La regola del gregge e la regola "il Megafono vince il pareggio" sono state tolte.

## Messaggi tra i giocatori
Chat di stanza (tasto 💬): messaggi fino a 140 caratteri, ultimi 60 conservati, limite di un messaggio ogni 0,7 s. Non c'è filtro sui contenuti. Gli schermi condivisi non vedono la chat.

## Fuori programma (fuori programma) — a tempo
**Quando.** Fino a 5 giocatori c'è **un fuori programma** dopo il turno ⌊turni totali / 2⌋ (3 giocatori: dopo il turno 3; 4 e 5: dopo il turno 2). **Con 6 giocatori** ce ne sono **due**, dopo i turni ⌊totali / 3⌋ e ⌊2 × totali / 3⌋ (turni 2 e 4). Ogni fuori programma è un fuori programma scelto a caso tra tre (L'Accusa, La storia d'amore, Il peggiore) e **i due di una partita sono sempre diversi**. L'fuori programma non consuma un turno da Megafono; durante la corsa non si giocano carte e le mani non cambiano, ma **alla fine dell'fuori programma le mani di tutti vengono rinnovate** (le carte vecchie vanno nello scarto, 5 nuove a testa).

**Come si gioca (modalità a tempo).** Si chiude il **sipario** con il titolo del fuori programma, si riapre sulla torre (vuota, con un **separé**), compaiono le regole (circa 4 s) e il **3-2-1-VIA!**. Poi **6 carte** pescate dal mazzo (uguali per tutti, di nessuno; sempre la **carta intera**, con le gambette) escono **una alla volta** da dietro il separé, si girano davanti a tutti (con un fascio di luce) e rientrano: **3 secondi a testa**. Ci sono **3 giri completi** (18 uscite; ogni giro in ordine nuovo, senza ripetere subito l'ultima carta del giro prima). Un riquadro in alto a destra dice «Giro x di y» e **quanti giri mancano** («Mancano 2 giri», «Manca 1 giro», «ULTIMO GIRO!»); a ogni nuovo giro compare una scritta grande. Ognuno ha un **pulsante grande in basso, «QUESTO!»**: premendolo vota (una sola volta, non si cambia) la carta che è in scena in quel momento. Nell'**Accusa** e nella **Storia d'amore** di lato sulla torre c'è anche l'**accusatore** / il **partner** (carta pescata a parte, non votabile); nell'Accusa la frase d'accusa resta scritta in alto. Si vede solo la torre e le carte, con una riga di testo.
L'fuori programma finisce quando hanno votato tutti oppure quando le carte sono uscite per 3 giri.

**Chi vince e chi cade.** Vince la carta con **più voti**; a **parità** vincono (cadono) tutte quelle in testa. *Accusa* e *Il peggiore*: le carte in testa **cadono** dalla torre. *La storia d'amore*: le carte in testa **vincono e restano** (incontrano il partner). Se nessuno ha votato, non cade e non vince nessuno.

**Punti (uguali nelle tre modalità).** **+2** a chi ha votato una carta in testa; **+4** al **più veloce** di loro (il primo il cui voto è arrivato al server, uno solo). Chi non vota in tempo non prende nulla e non perde nulla.

**Riepilogo punti (turni normali e fuori programma, tutto visivo).** Niente elenco di testo: i risultati si leggono sulla torre. Su ogni carta, una colonna di riquadri con la **faccia del giocatore e i suoi punti** per quella carta (verde se guadagna, grigio se 0, rosso se perde; ⚡ per il più veloce dell'fuori programma; 🚫 sotto, nella riga dei guadagni, per chi ha perso il voto); sulle **carte cadute** una grossa freccia rossa che rimbalza e un velo rosso (nella Storia d'amore, un cuore sulle carte che vincono). Sotto la torre una riga con la faccia di ognuno e i punti guadagnati nel turno, dal più alto (il tuo è evidenziato). Poi «Continua» e la classifica. Così la torre resta sempre visibile, anche sui telefoni corti.

**Verdetto e scenetta finale.** Finita la corsa il **sipario si richiude** («E ORA… IL VERDETTO!»), poi si riapre sulla **scenetta finale**, in stile cinema: bande nere, sottotitolo, macchina da presa che si avvicina e trema all'urto, effetti sonori. Dura circa **8–13 s** (con «Salta ›»; in modalità movimento ridotto si passa direttamente ai punti). *Accusa* — le altre carte escono di scena e restano solo l'accusatore e gli accusati: l'accusatore insegue l'accusato per tutta la terrazza finché lo butta giù dalla torre (più accusati: uno dopo l'altro, sempre più rapidi). *Il peggiore* — come ai concerti: le carte non cadute si mettono in fila, sollevano sopra di sé il peggiore, steso in orizzontale, lo portano di mano in mano da un lato all'altro (circa 3 secondi) e lo lanciano giù dalla torre (più carte cadute: una alla volta, ripartendo dallo stesso lato). *La storia d'amore* — le altre carte escono di scena e restano solo gli innamorati: il partner e i vincitori si avvicinano e dal loro abbraccio sgorgano cuori che cadono dalla torre come fontane. Poi il **sipario si richiude** («FINE INTERVALLO»), si riapre sul riepilogo «Chi prende punti» e sulla classifica; la ripresa automatica arriva dopo 75 s.

**Server.** Il server dà il «via» (`goAt`, orologio del server; i client lo convertono con l'orologio del messaggio) e decide chi ha votato in tempo: un voto vale solo se arriva mentre il personaggio è in scena, con un margine di 0,3 s prima e 0,7 s dopo per la rete e i riflessi (la finestra è lunga quanto i 3 secondi della carta) (altrimenti errore `NOT_ON_STAGE`). A fine corsa (`endAt`) conta i voti arrivati. Parametri in `packages/game-engine` (`MINI_*`: 6 carte, 3 giri, 3 s a carta, 6 s di sipario e regole + 3 s di 3-2-1) e `apps/web/src/lib/miniScenes.ts` (`TS`, durata delle scenette) e `worker/src/RoomCore.ts` (`LIMITS.run*`).

Bot: votano da soli, ciascuno nel momento in cui il personaggio scelto è in scena (con un po' di ritardo umano). Accusa: affinità tra personaggio e accusa; Il peggiore: i personaggi che cadono spesso un po' di più; Storia d'amore: scelta quasi libera.

## Spiegazione del Lui! sulla Torre (tutte le versioni)
Durante il voto, toccando il gettone Lui! posato su una carta si apre un popup che spiega in breve come funziona: agli altri mostra i 2 gettoni della partita («può essere uno di questi», senza dire quale), al Megafono quello che ha posato. I testi seguono la variante (normale o «Il gregge»).

## Uscire dalla partita
Un giocatore umano può uscire in qualsiasi momento (Regolamento «i» → «Esci dalla partita», con conferma). Se nella stanza restano **altri umani** (anche temporaneamente offline), un **giocatore virtuale di livello medio** prende il suo posto: stessa posizione, stessi punti e stessa mano, e gli altri vedono un avviso. Se chi esce era l'host, il ruolo passa a un altro umano. Se **non restano umani**, la stanza si chiude subito. Il vecchio accesso non è più valido.


### Riepilogo punti: icone dei motivi
Sulla torre i riquadri dei punti stanno in basso sulla carta (una o due colonne, al più metà carta) e portano sull'angolo l'icona del motivo; la stessa icona compare accanto ai punti di ogni giocatore nella striscia sotto la torre. bersaglio = voto giusto · fulmine = il più veloce · carta = carta propria · mano = Lui! · bandiera = obiettivo (icone disegnate in `ReasonIcon.tsx`, stile delle illustrazioni). I punti a 0 non hanno icona. Alla fine del turno (anche base) si prosegue solo toccando «Continua».

### Sovrapposizioni e Megafono
Segnalini, riquadri dei punti e frecce stanno solo nella parte visibile di ogni carta (`visibleRect` in `lib/results.ts`): la fila davanti copre il fondo di quella dietro. Il Lui! sta a sinistra, al centro della parte visibile. L'icona del Megafono è una sola (`scene/megaIcon.ts` / `MegaIcon`), usata ovunque.

### Dopo la caduta
Chi ha visto spoglio e caduta non rivede i punti: finita la scena si passa da soli alla classifica dopo ~2 s (subito se si è saltata l'animazione della caduta). Chi arriva a turno già iniziato vede ancora il riepilogo dei punti con «Continua».

### Fuori programma: introduzione, chiusura e bot
- **Introduzione**: due frasi corte (chi si vota e come si fanno punti), visibili circa 7 s dopo l'apertura del sipario (`MINI_INTRO_MS` = 9 s prima del 3-2-1).
- **Chiusura**: la scenetta finale porta direttamente ai punti e alla classifica; il sipario si chiude solo alla fine («E ORA… TORNIAMO ALLA PARTITA!», ~2 s), quando l'host preme «Riprendiamo la partita».
- **Bot**: votano come persone (`planMiniVote`): guardano le carte man mano che escono, le giudicano con un po' di sfocatura (più alta ai livelli bassi), premono al primo giro solo se evidente, altrimenti dopo aver visto tutte le carte; tempo di reazione 0,65–2,75 s (più lungo ai livelli bassi, più corto se impulsivi); a volte sono troppo tardi. Usano solo informazioni pubbliche.
- **Riepilogo punti**: sulle carte restano solo le frecce (e i cuori nella Storia d'amore); i punti sono nei chip in basso, due per riga.
