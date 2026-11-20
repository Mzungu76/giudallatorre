# Espansioni (mazzi tematici acquistabili)

Pagina **`/espansioni`** (icona della scatola in Home, accanto a statistiche/condividi/installa). Mockup di riferimento: `mockups/espansioni.html`.

## Cosa c'è oggi (test)
- Un mazzo di prova, **Summit**: 36 carte personaggio (`public/espansioni/summit/c01..c36.webp`, 320×480) + 18 frasi del Megafono (`content/espansioni/summit/frasi.json`, stesso formato di `content/frasi-megafono.json`).
- Pagina con scatolina 3D (`components/Scatola.tsx`) su ripiano, foglio di dettaglio con anteprima (le prime `anteprima` carte in chiaro, le altre grigie finché il mazzo non è tuo), frase d'esempio, acquisto, interruttore «Usa in partita».
- Il mazzo posseduto e la scelta «usa» sono salvati **solo sul dispositivo** (`localStorage`, chiave `gdt.espansioni`, `lib/espansioni.ts`). Nessun account.
- **Modalità prova** (`PAGAMENTI_ATTIVI = false` in `lib/espansioni.ts`): «Compralo» sblocca il mazzo senza pagare e compare «Blocca di nuovo (prova)». Con `true` queste due cose spariscono e `onCompra` va collegato al pagamento.

## Aggiungere un mazzo
1. Immagini in `public/espansioni/<id>/cNN.webp` (NN con due cifre, da 01); frasi in `content/espansioni/<id>/frasi.json` (verbo `sale`/`salgono`, famiglia ed età come per le frasi base).
2. Una voce in `public/espansioni/catalogo.json` (`id`, `nome`, `colore`, `prezzo`, `stato` `vendita`/`arrivo`, `novita`, `descrizione`, `personaggi`, `frasi`, `anteprima`, `scatola` = tre numeri di carta per il fronte della scatola, `esempio`, `cartella`, `carte`).
3. **Aumenta `versione` del catalogo**: l'app lo rilegge all'apertura della pagina (e usa quello incluso se manca la rete).
4. `npm test`: `packages/game-engine/tests/espansioni.test.ts` controlla che le carte esistano, i conti tornino e le frasi rispettino le regole (`docs/FRASI_MEGAFONO.md`).
Nomi, descrizione e prezzo stanno nel catalogo (dati). I testi fissi della pagina sono in `public/testi.json` (chiavi `esp.*`).

## Non ancora fatto
- **Pagamento e codici di sblocco** (Lemon Squeezy/Stripe + verifica nel Worker): oggi non c'è nessun acquisto vero.
- **Consegna protetta delle carte**: le immagini in `public/` sono scaricabili da chiunque. Prima di vendere, le carte oltre l'anteprima vanno servite dal Worker solo con un codice valido (es. da R2).
- **Uso in partita**: il mazzo scelto non entra ancora nelle partite (personaggi in mano/Torre e frasi nel mazzo del Megafono: `buildPhraseDeck`, manifest delle carte, protocollo, bot). Chi crea la stanza decide; vale per tutti.
- Pagina riservata per caricare i mazzi; proposta a fine partita; riordino delle icone della Home in un menu; frasi/etichette dei bot per i nuovi personaggi.
