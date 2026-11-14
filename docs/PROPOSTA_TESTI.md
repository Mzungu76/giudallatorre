# Proposta: meno testo, più immagini (da approvare)

Totale: 594 voci in `public/testi.json`. Le sezioni con più testo: Regolamento (2586 car.), Turno normale (2313), Pannelli in basso (2146), Stanza/lobby (1627), PROPAGANDA (1126), Prima partita (973), Fuori programma (≈1100 con i 3 giochi).
Principio: ogni concetto si spiega con i simboli del gioco (gettoni, frecce, icone dei punti, mani); il testo resta solo come etichetta di 1–3 parole. Nessuna frase sopra le ~90 battute.

## 1. Fuori programma (nome già applicato)
| Oggi | Proposta |
|---|---|
| `how.4.int.x` (375 car.) + 3 × `mini.*.regola` (~155 car.) | Una striscia a icone: 🎭 carte che escono dal separé → dito su «QUESTO!» → 🎯 +2 / ⚡ +4. Testo: «Premi QUESTO! quando esce quella giusta.» (≈45 car.) |
| `mg.mani` «Turno {n} di {tot} · poi 5 carte nuove per tutti» | icona 🃏×5 con «5 nuove» |
| `mr.fin.*` frasi di scena | restano (sono didascalie corte) |

## 2. Prima partita / schermata Megafono (≈1500 car.)
| Oggi | Proposta |
|---|---|
| `intro.1.card.testo` (248) | 3 vignette: 📣 Megafono → 🃏 la folla gioca → 🗳 si vota. Un'etichetta per vignetta. |
| `intro.2.p*.x` (130–160 ciascuno) | tolgo le frasi, tengo i titoli (già brevi) più un'icona animata (carta che sale, mano che vota, freccia che cade) |
| `intro.2.p4.x` (164, battute) | resta come unica frase «di colore», accorciata: «Tranquilli: sotto ci sono i materassi.» |
| `mega.*` (569 car. totali) | icone: segnalino coperto → carta; i tre gettoni con +4 / +2 / 🚫 già disegnati, via le frasi |

## 3. Regolamento (2586 car.)
Resta come pagina di consultazione, ma ogni scheda diventa: **icona grande + titolo + una riga**. Esempi:
- `how.1.p1..p4.x` (93–150) → «Il Megafono sceglie una frase» / «Tutti giocano una carta» / «Tutti votano» / «La più votata cade» + le stesse 4 icone dell'intro.
- `how.1.pari.x` (105) → disegno di due carte a pari voti: con CADE cade solo quella col segnalino, altrimenti tutte; didascalia «Pari: CADE decide».
- `how.3.*` (gregge, imbroglio, soglie: 100–250 car.) → ogni gettone ha la sua mini-scheda: gettone + effetto in ≤ 40 car. + esempio disegnato.
- `how.4.fine.x` (191) → «Tutti fanno il Megafono. Vince chi ha più punti.» (45)
- `how.4.parla.x` (111) → «Bluffa quanto vuoi. Non mostrare la tua carta.» (45)

## 4. Pannelli in basso e popup dei gettoni (2146 car.)
`bui.info.*` / `bui.popup.*` (100–140 car.) → un unico formato: **gettone + simbolo effetto + ≤ 40 car.**, es. Imbroglio!: «🚫 I voti su questa carta non valgono. +3 se ne annulli uno.» I testi ripetuti fra popup e info (gregge compare 5 volte) si riducono a una sola voce condivisa.

## 5. Stanza e lobby (1627 car.)
`room.gregge.info` (260), `room.obiettivi.info` (140), `room.propaganda.info` (120) → interruttori con icona della variante + ≤ 50 car.; il testo lungo si apre solo toccando «i».

## 6. Suggerimenti a fumetto e Aiuto
`hint.*` (97–110) → ≤ 50 car. con la stessa icona del passo; il fumetto mostra l'icona animata accanto al testo.

## 7. Errori
`err.*` (100–120) → resta il testo (serve), ma una sola riga ≤ 70 car. e l'azione («Riprova»).

## 8. Da non toccare
Frasi del Megafono (`content/*.json`, dati del server), scritte buffe della caduta, nomi e battute dei personaggi.

## Ordine di lavoro proposto
1. Fuori programma + Prima partita + scheda Megafono (le più viste)
2. Pannelli in basso e popup gettoni
3. Regolamento a schede con icone
4. Lobby, suggerimenti, errori
