# Torri degli utenti (modalità «One shot» condivisibile)

Stato: **fasi 1 (moderazione) e 2 (creazione, link, voto, risultati, immagini social, gestione) fatte; mancano le notifiche push**. Mockup: `mockups/torri-utente.html` (la terrazza è uno screenshot della scena vera dell'app: dalla pagina di sviluppo `/__terrazza?c=<carte>&m=1:cade&sel=3&sink=3&s=1`, immagini in `mockups/torri-utente-assets/`).

## Idea
L'utente crea una torre (3–6 carte, una frase, il segnalino su una carta e il proprio voto, fissi) e la propone come un sondaggio: un link da condividere su WhatsApp, social, ecc. Chi lo apre vota una volta; i risultati escono **alla chiusura**.

## Decisioni (risposte del proprietario)
- **Frase**: una sola (la frase del Megafono «Oggi sale sulla torre…»), libera (moderata) o scelta dal mazzo (ricerca + filtri per famiglia ed età, «altre tre a caso»).
- **Carte**: da 3 a 6; base e **espansioni possedute dall'autore** (nel link si vedono a tutti: va deciso insieme alla consegna protetta).
- **Segnalino**: CADE / NON CADE / VOTI NULLI su una carta, voto dell'autore fisso per tutti.
- **Apertura**: 24 ore, 3 giorni o 7 giorni, scelti dall'autore. **Risultati visibili 24 ore** dopo la chiusura, poi la torre si cancella.
- **Risultati solo alla chiusura**; i votanti sono avvisati con **notifica push** (+ il link mostra comunque i risultati).
- **Punti e vincitori**: stessi punti del gioco (voto giusto +2, segnalino +4/+2). **A pari punti vince chi ha votato prima**, mostrando l'ordine di voto. Nickname scelto dopo il voto, altrimenti «Anonimo».
- **Età**: calcolata dalla moderazione (età minima, non abbassabile), scritta nel link e sull'immagine social. Per **14+ e 18+** schermata «Hai almeno N anni?» prima di mostrare la torre (dichiarazione, nessuna verifica). Per **18+** l'immagine social **non mostra la frase**.
- **Nomi di persone**: ammessi solo i **personaggi pubblici** (l'autore lo dichiara; i nomi noti dei mazzi non vengono segnalati).
- **Annullamento**: libero entro **10 minuti**; poi **chiusura anticipata** con procedura in 3 passi (motivo, conferma scritta «CHIUDI», avviso ai votanti); con zero voti si può eliminare.
- **Segnalazioni**: tasto «Segnala», con più segnalazioni la torre si nasconde in attesa di verifica.

## Architettura proposta (costo zero)
- **Una torre = un Durable Object (SQLite)**, come le stanze: dati, voti, immagine social e allarme di chiusura/cancellazione. Niente R2 (potrebbe chiedere una carta).
- **Link** `/t/<id>`: pagina del Worker con i meta tag Open Graph (titolo-domanda, età, scadenza) e l'immagine `/t/<id>/og.jpg`.
- **Immagini social**: disegnate dal telefono dell'autore alla creazione (come la cartolina) e caricate; due formati: 1200×630 (anteprima link) e 1080×1920 (storie/stato WhatsApp). Mai segnalino né voto dell'autore.
- **Notifiche push**: sottoscrizioni salvate nella torre, invio all'allarme di chiusura; su iPhone solo con l'app aggiunta alla Home. Chi non le attiva torna dal link.
- **Voto unico per dispositivo** (token nel browser + limiti per IP): aggirabile, accettato per un gioco tra amici. Creazione limitata per IP.
- Fasi: 1) **moderazione** (fatta), 2) creazione + link + voto + risultati, 3) immagini social, 4) notifiche push, 5) segnalazioni/gestione.

## Moderazione (fase 1, valida per tutta l'app)
Regole nostre, nessun servizio esterno: `content/moderazione.json` (elenchi per categoria con età minima: odio, minacce, bestemmie, dati personali → **vietate**; volgarità forti, sesso, droga, suicidio → 18+; violenza, alcol/fumo, nudità, temi adulti, volgarità lievi → 14+; insulti lievi → 10+) e `packages/game-protocol/src/moderazione.ts` (`valuta`, `verificaFrase`, `nicknameAmmesso`, `nomiNoti`).
- Riconosce i camuffamenti (c4zzo, c.a.z.z.o, ca*zo, caaazzo), le espressioni di più parole, email/link/@profili/telefoni, e ha elenchi di **eccezioni** per le parole innocue che contengono una radice (cazzuola, culotte, puttanesca…).
- **Dove agisce già**: i **nickname** (creare/entrare in una stanza), le **frasi libere del Megafono** (per l'età della stanza: errori `PHRASE_AGE` / `PHRASE_BLOCKED`, avviso sotto il campo). Restano fuori chat e frasi dei mazzi (si controllano nei test).
- **Calibratura** (`packages/game-protocol/tests/moderazione.test.ts`): sulle 474 frasi/confessioni del gioco e dei mazzi di espansione gli elenchi non chiedono mai un'età maggiore di quella assegnata (2 eccezioni note: «tradire sotto interrogatorio», «tradito la fiducia»). Hanno trovato una frase del mazzo *Cosplay Super 1* con «preservativo» segnata 10+ → portata a 18+.
- **Limite**: è una soglia minima. Sulle frasi del gioco colpisce solo una parte delle 14+ (circa 21%) e delle 18+ (circa 31%), perché molte sono allusioni senza parole esplicite («i più infedeli», «chi sparirebbe in camera»). Per questo l'età scelta dall'autore può solo salire e ci sono le segnalazioni.
- Elenchi da completare nel tempo guardando segnalazioni e falsi positivi: si modifica solo il JSON; i test dicono se diventano troppo severi.

## Come è fatto (fase 2)
- **Logica pura**: `worker/src/torriCore.ts` (creazione con moderazione e controlli, voto, punti, risultati, annullo/chiusura, segnalazioni) con i test `worker/tests/torri.test.ts`.
- **Durable Object** `TowerPoll` (`worker/src/TowerPoll.ts`, binding `TORRI`, migrazione v2): una riga JSON in SQLite, allarmi di chiusura e di cancellazione (24 h dopo la chiusura). Identità: il dispositivo manda un id casuale (`gdt.dev`), il server salva solo l'impronta SHA-256; l'autore ha un token segreto (solo impronta sul server, token nel browser: `gdt.torri`).
- **API** (`worker/src/torriRotte.ts`): `POST /api/torri`, `GET/POST /api/torri/<id>/{view,vote,nick,cancel,close,report,og}`; limiti per IP. Prova a mano: `node scripts/e2e-torri.mjs` con `npm run dev`.
- **Pagina social** `/t/<id>` (`run_worker_first` in `wrangler.jsonc`): il Worker serve l'app con i meta tag Open Graph/Twitter (titolo-domanda, età; per 18+ senza la frase) e `/t/<id>/og.jpg`. L'immagine 1200×630 è disegnata dal telefono dell'autore alla pubblicazione (`apps/web/src/lib/torriOg.ts`); quella verticale 1080×1920 per le storie si genera al momento ("Immagine per le storie").
- **App**: `/torri/nuova` (4 passi: carte, frase con moderazione e idee dal mazzo, segnalino+voto sulla terrazza vera, durata) e `/t/<id>` (conferma età per 14+/18+, voto, nickname, promemoria .ics, risultati con percentuali sulle carte e classifica, segnalazione; per l'autore condivisione WhatsApp/Telegram/copia/storie, annullo entro 10 minuti, poi chiusura anticipata in 3 passi). Pulsante «Crea una torre» in Home.
- **Regole rispetto al gioco**: voto unico per dispositivo, il segnalino e il voto dell'autore non escono mai prima della chiusura (il test lo verifica), a parità di punti vince chi ha votato prima.
- **Da fare**: notifiche push alla chiusura (oggi: promemoria calendario + link); verifica delle espansioni possedute (come per le partite: il server si fida); archivio «le mie torri»; pulizia dei dati più vecchi se servisse.
