# Audio dell'app

Carica qui i file MP3 (minuscolo, senza spazi né accenti).

## Musica (loop 30-60 s)
- musica-tema.mp3       lobby, menu, attesa
- musica-suspense.mp3   suspense: parte appena le carte hanno finito di salire sulla torre e dura per il voto e lo spoglio; quando comincia l'animazione della caduta torna musica-tema.mp3. Se il file manca, resta il tema.
- intervallo-jingle.mp3   suono breve (non in loop) all'annuncio dell'intervallo; finito, parte il tema dell'intervallo
- intervallo-accusa.mp3  intervallo-amore.mp3  intervallo-peggiore.mp3   tema (loop) di ciascun intervallo, fino alla scenetta finale (esclusa: da lì torna musica-tema.mp3); se manca, suona musica-suspense.mp3
- musica-finale.mp3     (loop) dalla pagina delle statistiche («Luoghi comuni») in poi: classifica finale e tutto ciò che segue; se manca resta musica-tema.mp3
- musica-fart.mp3       (breve, circa 3 s, non in loop) la pernacchia: suona nel momento preciso in cui la carta caduta tocca i materassi; se manca, niente
- musica-segnapunti.mp3 (breve, jingle, non in loop) all'inizio del percorso dei punti, dopo la caduta; se manca, niente
- jingle-inizio.mp3     stacco 3-5 s, non in loop

## Effetti (sostituiscono quelli sintetici di apps/web/src/lib/sfx.ts)
- whoosh.mp3  tap.mp3  drum.mp3  stamp.mp3  ding.mp3  fanfare.mp3  tada.mp3

## Effetti nuovi da quiz (facoltativi)
- risposta-giusta.mp3  buzzer.mp3  applausi.mp3  countdown.mp3  timer-suspense.mp3

Ricorda di annotare l'autore e la licenza di ogni brano in CREDITI.md
(obbligatorio per Kevin MacLeod e per ogni brano CC-BY).

Peso: i brani lunghi sono a 128 kbps stereo (circa 1 MB al minuto). Per ricodificare: `ffmpeg -i originale.mp3 -c:a libmp3lame -b:a 128k nuovo.mp3`.
