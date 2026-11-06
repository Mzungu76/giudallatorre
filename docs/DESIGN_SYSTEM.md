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
