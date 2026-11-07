# DESIGN SYSTEM — v2 "pop irriverente" (approvato in direzione)

Riferimenti vivi: `mockups/pop.html` (tutte le schermate), `mockups/wow/b4-caduta.html` (prototipo animato). Pagine pubblicate: vedi `docs/PROGRESS.md`.

## Identità
Poster pop da fumetto, ironico, colorato ma non infantile. Le illustrazioni originali sono protagoniste: personaggi **scontornati** come adesivi (bordo bianco + ombra dura), torre e mani della copertina del regolamento.

## Palette
carta `#f4e3bd` · rosso `#e8362b` (Megafono, frase, azione forte) · senape `#ffc72c` (azione primaria) · inchiostro `#13224a` (contorni, ombre dure, testo) · verde acqua `#14a3a1` · cielo `#79d3ee/#4fbce6` (raggi) · rosa `#ff7aa8`. Colori giocatore (8): `#e5384b #2f7be0 #f4c20d #3aa655 #8a5a3b #8e44c8 #ee7bb0 #222`.

## Tipografia
Titoli e pulsanti: **Anton** (maiuscolo, con ombre estruse rosso+inchiostro). Appunti a mano: **Caveat Brush**. Testo: **Nunito** 700–800.

## Componenti
- **Pulsante a adesivo**: bordo 3px inchiostro, ombra dura 5px, Anton 25px; varianti senape / rosso / carta / disattivo. Biglietto “Conferma” con taglio e linguetta, pulsa piano.
- **Pannello carta**, **banner rosso** (frase), **chip**, **timbro** (ruota e “cala” con tremolio), **segnalini voto** (dischi colorati con numero), **targhette numeriche** dorate.
- **Cornice** da pagina di fumetto (inchiostro/carta/inchiostro), angoli a mezzatinta, grana di carta.
- **Personaggio**: sticker (bordo bianco 2.5px + ombra 5px); carte intere solo dove servono (mano, scelta).
- **Torre**: versione pop con contorno e mezzatinta sul lato in ombra; i personaggi spuntano dietro i merli (5 giocatori: due altezze; 8: tre livelli).

## Movimento
Sequenza di voto e caduta: segnalini che rimbalzano, timbro, suspense, spinta (“SPINTO!”), caduta con camera che segue e scena inclinata, lampo + esplosione + onde + coriandoli all'impatto, materassi che si piegano, folla di mani con oggetti buffi diversi a ogni caduta. Rispetta `prefers-reduced-motion` (animazioni ambientali ferme; “Salta” sempre disponibile).

## Responsive / navigazione
Telefono 360–430 px a colonna singola; schermo condiviso 16:9 con soli dati pubblici. Flusso guidato dalla fase decisa dal server.

## Limiti noti
Illustrazioni 320×480: ottime fino a ~150 px CSS, morbide a tutto schermo. Prototipo non provato su telefoni reali. Disposizione a 8 giocatori da validare con più prove su schermi piccoli.

## Fase 6 — Terrazza, salita, spoglio, caduta (dai mockup approvati)
- **Terrazza** (`components/Terrace.tsx`, `scene/draw.ts`): vista quasi dall'alto, pietra sabbia con contorno inchiostro e mezzatinta a puntini, bordo con merli su tutto il perimetro e fascia di beccatelli. Carte **intere** su **un solo piedino nero centrato**, con ombra, leggermente irregolari e sovrapposte. Gettoni di voto direttamente sulla carta (colore del giocatore; il Megafono ha il megafono). Lui!: giallo **CADE "4"**, **NON CADE "1"**, coperto = scuro con "?". Tasto **?** = come si fanno punti.
- **Salita** (`Climb`, ~2,4 s + piazzamento + giro): le carte coperte salgono la scala interna della Torre, si vedono passare dalle finestre (92×138, un po' più piccole del mockup), poi si piazzano coperte in ordine casuale e si girano una a una.
- **Spoglio** (`Reveal`, ~5 s): sfondo scuro, rullo, un gettone per volta direttamente sulla carta con "X ha votato… il N!", contatore, il Megafono vota per ultimo (gettone più grande) dopo la pausa "Manca l'ultimo voto…", poi il più votato, il Lui! che si gira e infine il pannello "Chi prende punti": una riga per giocatore con i motivi in chiaro (✓ Voto giusto, 🃏 Sua carta caduta, 📣 N voti raccolti, 🎯 Lui!) e il totale; i "+N" salgono dalle carte in sincronia con le righe; sotto, chi non prende punti. Poi timbro "Cade il n. N!" (o "Pareggio! Decide il Megafono": il suo gettone, con il simbolo "=", lampeggia e si illumina).
- **Caduta** (`scene/fallScene.ts`): torre di profilo con terrazza, merli e carte che spuntano; la carta votata viene spinta giù, materassi, mani con oggetti buffi (invariati).
- **Classifica** dopo ogni turno (punti del turno + totale che si somma, ordinata), classifica del giro a fine giro, Spareggio (Golden goal) segnalato; malus −1 mostrato con "−".
- **Intermezzi**: striscioni a ogni cambio fase ("Scegliete la carta!", "Votate!", "Spareggio!"…).
- **Layout adattivo**: larghezza logica 372, altezza logica 640–940 in base allo schermo (`ui.tsx`, `Stage`, `useStage`): i bottoni stanno ancorati in basso, la scena si sposta in verticale e la frase si riduce sugli schermi bassi. Provato a 360×640, 390×844 e 412×915.
- **Modalità veloce**: `?fast=1` (o "riduci animazioni" del sistema) salta salita, spoglio e caduta; è usata dai test automatici.

## Personaggi, carte e segnalini (illustrati)
Gli otto giocatori sono otto personaggi (`public/giocatori/`): `card-N.webp` (carta giocatore), `tok-N.webp` (segnalino tondo), `torre.webp` (torre della schermata finale). Il colore del giocatore (`CHAR_COLORS` in `lib/characters.ts`) decide la coppia carta/segnalino; a inizio partita ognuno vede il proprio personaggio (`CharIntro`). Tutti i dischetti `.dc`, i gettoni di voto e le pedine della torre usano il segnalino. Il segnalino del Megafono ha il megafono in alto a sinistra e l'icona di spareggio "=" in alto a destra (a metà fuori dal bordo; lampeggia quando lo spareggio è usato). La schermata finale (`FinalScene`) usa la torre illustrata e le carte dei giocatori: salgono, il primo butta giù le altre sui materassi.

## Layout B (smartphone): pannello in basso
Sostituisce barra in alto + nastro del titolo + riquadri di istruzioni. Mockup di riferimento: `mockups/layout-telefono-b.html` (generato da `tools/mockup_layout_b.*`).
- **In alto** (`BMeta`, `PhrasePill` in `components/BUi.tsx`): una riga con turno (e timer) e Megafono; sotto, la frase su due righe. Un tocco la apre, un altro la chiude, e si richiude da sola dopo 6 s (`useTimedOpen`, barra rossa). Vale anche per le frasi tra cui sceglie il Megafono.
- **In basso** (`BSheet`): titolo e istruzione breve, tasti chat, classifica e regolamento («i»), poi il bottone della fase. A sinistra del bottone i segnalini Lui! del giocatore (`LuiTray`, un tocco li apre grandi: `LuiPopup`).
- **Scena** (`ui.tsx`, `calcDims`): la terrazza sta tra la frase (~102 px) e il pannello (~196 px); la torre prosegue sotto il pannello. `Terrace`, `Climb` e `Reveal` usano le stesse misure.
- **Finestre** (gestite in `Room.tsx`): chat a tutto schermo (`Chat.tsx`), classifica rapida (`Standings`), regolamento a schede con i suoni (`HowTo.tsx`), segnalini Lui!.
- **Mano**: carosello (`HandPicker`); un tocco sceglie la carta, un secondo la ingrandisce. La frase del Megafono si sceglie con un tocco e si conferma con «Proclama».
- **Intervallo** (`MiniGame.tsx`): annuncio con nastro, carta illustrata e tre passi; poi stessa struttura del turno.
- Lo schermo condiviso (sola visione) usa gli stessi componenti senza icone né segnalini.
- Motore, protocollo e worker non cambiano. I test end-to-end usano `phrase-go` per confermare la frase e un secondo tocco su `confirm-vote` anche nell'intervallo.
