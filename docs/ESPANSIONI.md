# Espansioni (mazzi tematici acquistabili)

Pagina **`/espansioni`** (icona della scatola in Home, accanto a statistiche/condividi/installa). Mockup di riferimento: `mockups/espansioni.html`.

## Cosa c'è oggi (test)
- Mazzi di prova: **Summit** (figure pubbliche della politica mondiale) e **Anni '90** (personaggi dei film: `anni90-cNN`, 18 frasi in `content/espansioni/anni90/frasi.json`). Per i personaggi di fantasia le etichette dei bot sono di carattere (tipi e temi, v1 e v2) più ruolo/abbigliamento dove si vede; per i personaggi reali solo ruolo «politico» e abbigliamento visibile.
- Primo mazzo di prova, **Summit**: 36 carte personaggio (`public/espansioni/summit/c01..c36.webp`, 320×480) + 18 frasi del Megafono (`content/espansioni/summit/frasi.json`, stesso formato di `content/frasi-megafono.json`).
- Pagina con scatolina 3D (`components/Scatola.tsx`) su ripiano, foglio di dettaglio con anteprima (le prime `anteprima` carte in chiaro, le altre grigie finché il mazzo non è tuo), frase d'esempio, acquisto, interruttore «Usa in partita».
- Il mazzo posseduto e la scelta «usa» sono salvati **solo sul dispositivo** (`localStorage`, chiave `gdt.espansioni`, `lib/espansioni.ts`). Nessun account.
- **Modalità prova** (`PAGAMENTI_ATTIVI = false` in `lib/espansioni.ts`): «Compralo» sblocca il mazzo senza pagare e compare «Blocca di nuovo (prova)». Con `true` queste due cose spariscono e `onCompra` va collegato al pagamento.

## Giocarle in partita (test)
- **Creare la partita** (ultimo passo): se hai sbloccato dei mazzi compare «Espansioni» con un chip per mazzo (di default valgono gli interruttori «Usa in partita» della pagina). «Solo i loro personaggi» fa pescare solo carte dell'espansione (utile per provarla; vale se le carte bastano: 6 per giocatore, cioè fino a 6 giocatori con 36 carte).
- **Intensità** di ogni mazzo (`espLivelli`, id → `assaggio`/`meta`/`tutto`, predefinito `meta`): 12 / 18 / tutte le carte personaggio, estratte a sorte a ogni partita, e 1 / 3 / tutte le carte frase del Megafono (`ESP_QUOTE` in `worker/src/RoomCore.ts`; i numeri compaiono anche nelle note `esp.liv.nota.*` di `testi.json`). «Solo i loro personaggi» ignora l'intensità. Si sceglie accanto al nome del mazzo alla creazione e si ricorda come preferenza nel foglio del mazzo (pagina Espansioni).
- La richiesta di creazione porta `espansioni` (id), `espLivelli` e `soloEsp`; la stanza li tiene in `options` e la lobby mostra «Espansioni: Summit».
- All'avvio il server (`RoomCore`, `start`) aggiunge al mazzo le carte `<id>-cNN` (registro `EXPANSIONS` in `worker/src/content.ts`) e, subito dopo la mescolata del motore, inserisce le frasi del mazzo tra le prime 8 carte del Megafono (`expansionPhraseCards`/`insertEarly` in `packages/game-engine/src/phrases.ts`), così si vedono davvero. Dal turno 2 in poi: il turno 1 usa la prima carta già pescata.
- Le carte sono riconosciute dal client (`lib/cards.ts`) dall'id `<mazzo>-cNN` → `/espansioni/<mazzo>/cNN.webp`; sono carte intere (niente ritaglio). Il protocollo accetta questo id in `playCard`.
- **Il server si fida dell'host**: in prova non verifica che i mazzi siano pagati (basta che l'id esista). Con il pagamento vero va controllata una licenza.
- I bot giocano con le nuove carte anche senza etichette scritte a mano (test in `worker/tests/espansioni.test.ts`: partite complete a tutti i livelli). Per un personaggio nuovo i bot lo valutano come «neutro»: le etichette dedicate migliorerebbero le loro scelte (`content/etichette/`).

## Aggiungere un mazzo
0. Il mazzo diventa giocabile solo dopo aver aggiunto in `worker/src/content.ts` l'import delle sue frasi in `FRASI_ESPANSIONI`.
1. Immagini in `public/espansioni/<id>/cNN.webp` (NN con due cifre, da 01); frasi in `content/espansioni/<id>/frasi.json` (verbo `sale`/`salgono`, famiglia ed età come per le frasi base).
2. Una voce in `public/espansioni/catalogo.json` (`id`, `nome`, `colore`, `prezzo`, `stato` `vendita`/`arrivo`, `novita`, `descrizione`, `personaggi`, `frasi`, `anteprima`, `scatola` = tre numeri di carta per il fronte della scatola, `esempio`, `cartella`, `carte`).
3. **Aumenta `versione` del catalogo**: l'app lo rilegge all'apertura della pagina (e usa quello incluso se manca la rete).
4. `npm test`: `packages/game-engine/tests/espansioni.test.ts` controlla che le carte esistano, i conti tornino e le frasi rispettino le regole (`docs/FRASI_MEGAFONO.md`).
Nomi, descrizione e prezzo stanno nel catalogo (dati). I testi fissi della pagina sono in `public/testi.json` (chiavi `esp.*`).

## Non ancora fatto
- **Pagamento e codici di sblocco** (Lemon Squeezy/Stripe + verifica nel Worker): oggi non c'è nessun acquisto vero.
- **Consegna protetta delle carte**: le immagini in `public/` sono scaricabili da chiunque. Prima di vendere, le carte oltre l'anteprima vanno servite dal Worker solo con un codice valido (es. da R2).
- Modifica delle espansioni dalla lobby dopo la creazione (oggi si scelgono solo alla creazione).
- Pagina riservata per caricare i mazzi; proposta a fine partita; riordino delle icone della Home in un menu; frasi/etichette dei bot per i nuovi personaggi.
