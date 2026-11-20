# Torre del giorno

Modalità da solo: un turno già pronto (frase, 4 carte, segnalino piazzato in modo interessante, voti dei bot nascosti). Nessuna intro: si va dritti al voto; si vota e si vede il risultato; poi le **statistiche dei luoghi comuni** (la stessa pagina delle partite normali, calcolata in anticipo per ognuno dei 4 voti perché le etichette restano sul server) poi i **titoli di coda** del turno (gli stessi della partita, su sfondo scuro, con «Continua»: interpreti, «Cosa abbiamo capito oggi:», premi, Pregiudiziometro, critica; solo alla prima giocata, non quando riapri il risultato) e la **pagina finale** (punti che salgono, giudizio, emoji, serie e ultimi 7 giorni, condivisione). I punti e la serie di giorni restano sul telefono. **La Torre del giorno è una sola** (e si gioca una volta sola: se la riapri vedi il tuo risultato). Per più partite brevi c'è Flash.

## Quando nasce e quando si vede
- **Preparazione**: ogni giorno alle **23:50 (ora di Roma)** la GitHub Action `Torre del giorno` (`.github/workflows/torre-del-giorno.yml`) esegue `npx tsx tools/oggi/genera.ts --prepara 3`: crea i file mancanti per oggi e i 3 giorni dopo (`public/oggi/AAAA-MM-GG.json`), li salva nel repository e, se ci sono i segreti Cloudflare, pubblica il gioco. Il seme viene dalla data: stesso giorno, stessa Torre.
- **Pubblicazione**: alle **00:01 (ora di Roma)**. Prima di allora il Worker (`worker/src/torre.ts`) non fa vedere né il file del giorno né la data nell'elenco (`/oggi/indice.json`). L'app usa la data di Roma un minuto fa (`dayId` in `apps/web/src/lib/torre.ts`), quindi cambia per tutti nello stesso momento.
- **Nuova!**: sul pulsante «Torre del giorno» della home compare finché il giocatore non ha aperto la Torre di oggi (`visto` nell'archivio locale `gdt.torre`).
- Se la Torre di un giorno manca (il compito non è girato), l'app usa l'ultima pubblicata; se non ce n'è nessuna, una della riserva.

## Comandi
- `npx tsx tools/oggi/genera.ts --prepara 3` — come fa la Action.
- `npx tsx tools/oggi/genera.ts --riserva 40` — una tantum: Torri di scorta (`public/oggi/riserva/N.json`), usate solo se un giorno non ce n'è nessuna pubblicata.
- `npx tsx tools/oggi/genera.ts --indice` — riscrive `public/oggi/indice.json`.
- Provare dal PC la Torre di un giorno: `npm test` controlla che ogni Torre sia valida e un dilemma (`apps/web/tests/torre.test.ts`).

## Notifiche (non ancora fatte)
Servirebbe l'invio di notifiche push (VAPID, registrazione dei telefoni e un compito che le invii all'ora scelta) e un interruttore nelle impostazioni. Il piano gratuito di Cloudflare limita il calcolo per richiesta: da valutare prima di costruirle.

## Copertina rotocalco
Dalla pagina delle statistiche («Luoghi comuni») il pulsante **Condividi la copertina** disegna sul telefono un'immagine 1080×1350 in stile giornale scandalistico: la carta del «miglior lancio» a figura intera in bianco e nero con retino (mai ritagliata: lo sfondo è la stessa carta ingrandita), il titolo **«È un {tratto}»**, la scritta a pennarello con freccia verso il personaggio (cambia da una serata all'altra: 5 formule + una senza luogo comune) e la riga **«{Ruolo} = {tratto}: il luogo comune più votato!»**. Senza «miglior lancio» (pochi voti) la copertina dice «Giudicati dalla copertina» con la carta votata. I testi sono in `public/testi.json` (`rot.*`), il disegno in `apps/web/src/lib/rotocalco.ts`.
