# Aiuto ai giocatori (regole facili da imparare)

Principio: **si impara giocando, non leggendo**. Meno testo all'inizio, aiuto nel momento in cui serve, e sempre immagini (carte vere con il numero sul bordo, segnalini dei giocatori) invece di riferimenti tipo «carta n. 2».

## Cosa c'è
| Cosa | Quando compare | Dove |
|---|---|---|
| **3 schermate iniziali** (scopo, i 4 passi del turno, come si fanno i punti) | Alla prima partita su quel telefono (`localStorage gdt.intro`). Sempre saltabile. | `components/Intro.tsx` (`IntroSlides`) |
| **«Sei il Megafono!»** (cosa fai, come fai punti, se giochi o no una carta) | Le prime 2 volte che tocca a te, con «Non mostrare più» (`localStorage gdt.mega`) | `Intro.tsx` (`MegaIntro`) |
| **Ruolo sempre visibile**: chip dorato «📣 Sei il Megafono» in alto, pannello in basso dorato col badge 📣 e titolo «Sei il Megafono · …», messaggio «Questo turno non giochi carte» in attesa; nella variante «Il Megafono sa» cornice dorata e timbro 📣 sulla carta | Tutto il turno del Megafono | `BUi.tsx` (`BMeta`, `BSheet gold`), `Game.tsx` |
| **Menu «i» → Aiuto**: 1) «Cosa devo fare adesso?» (suggerimento con cerchio e freccia sul prossimo gesto: carta, pulsante, frase…), 2) «Rivedi il tutorial», 3) «Regolamento completo» | Sempre, dal tasto «i» in basso | `components/HelpMenu.tsx`, `lib/hints.tsx`, `IdleHint.tsx` (`HintPointer`) |
| **Icona dei punti** (stella dorata) sempre accanto ai numeri dei punti | Riepilogo, fuori programma, classifica, finale, gettoni Lui!, esempi | `components/Pt.tsx` |
| **Fumetto «Ti serve una mano?»** (anche con freccia) | **Solo** se devi agire (scegliere la frase, la carta, il Lui!, votare, o nell'fuori programma) e resti fermo ~14 s. Qualsiasi tocco lo fa sparire e riparte il conto; al massimo 2 volte per fase. | `components/IdleHint.tsx`, `Game.tsx`, `MiniGame.tsx` |
| **Esempi dei punti con carte vere** (un turno completo; il Lui! con voti e gettone) | Regolamento «i» → schede «I punti» e «I segnalini» | `components/PointsExamples.tsx` |
| **«Com'è andata»: la tua riga per prima** («Tu»), con i motivi in parole e la carta votata come immagine | Fine di ogni turno | `components/PointsPanel.tsx` |

## Per le prove
- Il ritardo del fumetto si cambia con `localStorage gdt.hintms` (millisecondi): `scripts/e2e-hints.mjs` lo imposta a 2500.
- `scripts/e2e-hints.mjs` gioca una partita con bot e controlla: tutorial a videate vere, scheda del Megafono, chip, pannelli dorati, fumetto (compare da fermi e sparisce al tocco), riga «Tu», esempi senza «n. 2».
- In modalità veloce (`gdt.fast`, `?fast=1`) la scheda del Megafono non compare.

## Da valutare con i giocatori
- Il ritardo del fumetto (14 s) e quante volte mostrare la scheda del Megafono (2).
- Se i fumetti aiutano chi è davvero fermo senza infastidire chi sta pensando.

## Videate del tutorial e del regolamento
Le immagini sono videate vere dell'app in `public/tutorial/*.webp`. Per rigenerarle dopo un cambio grafico: avviare il Worker in locale e lanciare `OUT=/percorso node scripts/capture-tutorial.mjs`, poi convertire i PNG in webp (larghezza 520). «Come si gioca» in Home apre il tutorial; il regolamento si apre dal menu «i» in partita.
