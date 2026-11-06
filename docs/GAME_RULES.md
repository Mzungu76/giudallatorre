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
1. Rivelazione voti (a partire dal giocatore successivo al Megafono).
2. Cade il personaggio con più voti. **Pareggio: cade SEMPRE il personaggio votato dal Megafono**, anche se ha solo il voto del Megafono (gli altri voti sono ignorati).
3. Punti:
   - **+2** a chi ha votato il personaggio caduto;
   - **+2** a chi ha giocato la carta caduta;
   - Megafono, segnalino "Lui!": **CADE LUI! → +4** se il personaggio è caduto; **NON CADE LUI! → +1** se non è caduto; altrimenti 0. Si somma agli altri punti.
4. Un giocatore può cumulare più bonus nel turno.

### Fine turno
- Voti tornano ai giocatori; carte rimaste sulla Torre → scarto.
- Ogni giocatore **tranne il Megafono** pesca 1 carta Personaggio (mano torna a 5; il Megafono non ha giocato carte).
- Mazzo esaurito → scarto rimescolato.
- Megafono + "Lui!" passano al giocatore alla **destra**.

## Fine partita
Termina quando tutti hanno fatto il Megafono: **1 volta (6–8 giocatori)**, **2 volte (3–5)**. Vince chi ha più punti; parità → vittoria condivisa. (Rounds extra possibili, sempre pari per tutti.)

## Discussione libera
Parlare è sempre consentito e non vincolante (bluff ammesso). **Vietato** rivelare la propria carta giocata prima del voto. Il Megafono "parla" solo con il megafono scenico. *(Online: regole sociali, non applicabili dal sistema; la chat testuale NON è inclusa salvo decisione.)*

## Implicazioni per il motore
Stato autorevole lato server; il client non decide punteggi, carte, esito voto, eliminazioni, vincitore. Le carte giocate e i voti restano segreti fino alla rivelazione.

## Decisioni aggiuntive
Si può votare la propria carta e quella del mazzo. Variante "Il Megafono sa" = opzione di stanza (il Megafono gioca dalla mano e ripesca).
