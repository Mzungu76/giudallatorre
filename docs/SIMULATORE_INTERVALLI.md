# Simulatore degli fuori programma

Pagina **`/intervalli`** (ad esempio `https://giu-dalla-torre-anteprima.giudallatorre.workers.dev/intervalli` per l'anteprima di una pull request). Fa vedere e giocare gli fuori programma a tempo **senza stanza e senza giocatori**, con il motore vero del gioco, le carte vere e gli stessi tempi: serve per lavorare sull'aspetto senza aspettare che l'fuori programma capiti in una partita.

## Controlli
- **Fuori programma**: L'Accusa, La storia d'amore, Il peggiore.
- **Parti da**: dall'inizio (sipario), dal 3-2-1, dalla corsa, dal verdetto e scenetta, dai punti.
- **Giocatori** (3–6) e livello dei **bot**.
- **Voti dei bot**: *casuali* (come nel gioco), *tutti subito* (prova l'attesa di 3 s dopo l'ultimo voto), *forzati* (scegli tu la carta o le carte in testa, anche a parità), *nessuno*.
- **Il tuo voto**: premi tu «QUESTO!» (stesso controllo del server: la carta deve essere in scena) oppure vota in automatico.
- **Altezza del telefono** (corto, medio, standard, lungo) e **suoni**.
- Un riquadro «Cosa succede» mostra fase, tempo dal via, carta in scena, giro, voti previsti e arrivati, esito e punti.
- **Copia il collegamento**: il collegamento riproduce lo scenario scelto (parametri `k` fuori programma, `p` partenza, `n` giocatori, `v` voti dei bot, `e` carte, `a` voto automatico, `l` bot, `h` altezza). Con `&go=1` parte da solo. Esempio: `/intervalli?k=peggiore&p=verdetto&v=forzato&e=2,5&a=1&go=1`.
- «Riprendiamo la partita» (a fine fuori programma) fa ricominciare la simulazione.

## Dove sta il codice
`apps/web/src/screens/Simulator.tsx` (pagina) e `apps/web/src/lib/miniSim.ts` (motore, tempi e voti dei bot: funzioni pure, con test in `apps/web/tests/miniSim.test.ts`). È uno strumento per chi sviluppa: i suoi testi non stanno in `public/testi.json`.

Solo in sviluppo (`npm run dev:web`) restano anche le pagine di prova `/__intervallo` e `/__terrazza`.
