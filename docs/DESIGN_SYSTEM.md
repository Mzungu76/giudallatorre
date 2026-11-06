# DESIGN SYSTEM — v1 (bozza per approvazione)

Riferimento visivo: `mockups/index.html` (galleria) e `mockups/preview/*.png`. Identità tratta dal regolamento originale: cielo azzurro, torre di pietra, logotipo blu petrolio con contorno arancio, pannelli color pesca, carte illustrate calde e ironiche.

## Palette
| Token | Valore | Uso |
|---|---|---|
| `--sky` / `--sky2` | #8fd6ea / #c9eef6 | sfondo (gradiente verticale) |
| `--teal` / `--teal-d` | #14607e / #0c3f56 | titoli, azione secondaria, bordi input |
| `--orange` / `--orange-d` | #f28a1e / #c96a08 | azione primaria, fase attiva |
| `--red` | #e5384b | Megafono, frase annunciata, “CADE LUI!”, azioni distruttive |
| `--cream` / `--pink` | #fff4d6 / #ffd9c9 | pannelli / avvisi |
| `--stone` / `--stone-d` | #cdb995 / #a8946f | Torre |
| `--green` | #3aa655 | punti positivi, ✓ |
| Colori giocatore (8) | #e5384b #2f7be0 #f4c20d #3aa655 #8a5a3b #8e44c8 #ee7bb0 #222 | disco, segnalino voto (come i 8 colori del gioco) |

Contrasto: testo scuro (#26303a/teal-d) su chiaro; testo bianco solo su teal/arancio/rosso (da verificare ≥4.5:1 in sviluppo; arancio con testo grande/bold ≥3:1). Il colore non è mai l’unico segnale: i giocatori hanno anche nome, i voti un numero.

## Tipografia
- Titoli e pulsanti: **League Spartan** 700/800 (è il font del regolamento originale).
- Testo: **Nunito** 600–800 (Google Fonts, gratuito; self-hosting nel build per PWA/offline).
- Logotipo: League Spartan 800, riempimento teal, contorno `--teal-d` 5px, ombra arancio; “Giù/dalla” bianco ruotato.
- Scala: 11 (etichette caps) · 13 · 15 · 17 (pulsanti) · 21 · 30 · 54 (numeri grandi).

## Componenti
- **Pulsante**: min-height 52px, raggio 16, ombra piena 5px (effetto “tasto”); varianti primario/arancio, teal, ghost, rosso, disabilitato.
- **Chip** (stato/turno), **Pannello** (crema, bordo bianco), **Banner frase** (rosso, etichetta “Marta dice”), **Riga giocatore** (disco colore + nome + tag), **Input** (bordo teal 3px, etichetta sempre visibile), **Segmented/Toggle**, **Stepper fasi** (3 barre).
- **Carta Personaggio**: rapporto 2:3, bordo crema 3px, ombra 4px; dimensioni: sm 64 · mano 92 · lg 104 · torre 86–138 (schermo condiviso) · xl 150 px. Numero (cerchio teal) in alto a sinistra sulla Torre. Stato selezionato: +16px su, anello arancio.
- **Torre**: pannello pietra con carte in griglia (3 colonne su telefono, 5 su schermo condiviso), numerate sinistra→destra, alto→basso come da regolamento.
- **Segnalino voto**: disco 30px col colore del giocatore + numero della carta votata. **“Lui!”**: placca quadrata ruotata (rossa = CADE, teal con “?” se coperta).

## Spaziature / forma
Griglia 4/8px; gutter 16px su telefono; raggio 14–18 per pannelli; ombre piene (non sfumate), niente glassmorphism.

## Icone
Poche, semplici e inline SVG (megafono, ✓, ×, lucchetto); emoji solo come bozza nei mockup, da sostituire con SVG.

## Responsive
- Telefono 360–430 px: una colonna, azione primaria in fondo (zona pollice), min target 48px.
- Tablet/PC: 2–3 colonne; **schermo condiviso** (/schermo/CODICE) 16:9, solo dati pubblici.
- Nessuno scroll orizzontale; la Torre si adatta (3 colonne ≤ 8 carte su telefono).

## Navigazione e regole UI
Flusso lineare guidato dalla fase (Home → Crea/Entra → Lobby → [Proclama → Gioca → Torre → Voto → Risultati → Caduta → Punti] × turni → Classifica). Il giocatore non sceglie la fase: la decide il server. Azioni irreversibili (Gioca carta, Conferma voto) richiedono un tocco dedicato e poi mostrano stato “inviato”. Riconnessione automatica con banner discreto.

## Movimento
Animazioni brevi (≤400 ms): carte che salgono sulla Torre, segnalini che si posano, caduta con rotazione, conteggio punti. Rispetto di `prefers-reduced-motion` (versione istantanea). Pulsante “salta animazione”.

## Dubbi aperti sul design
1. Illustrazioni in 320×480 px: vanno bene fino a ~150 px CSS (≈2× su schermi retina); ingrandimenti a tutto schermo risulteranno sfocati.
2. Le carte non hanno nomi: mostro solo il numero sulla Torre. OK?
3. Torre disegnata da me in SVG (semplice): la grafica originale (copertina del regolamento) è ricca; posso ricavarne la torre/illustrazione dal PDF se vuoi riusarla.
4. Chat testuale: non prevista (modalità tavolo = voce; remota = serve un canale esterno, es. chiamata). Vuoi una chat minima?
