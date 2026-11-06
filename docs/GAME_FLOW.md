# GAME_FLOW — fasi e transizioni (provvisorio, rev. 5.2l)

```mermaid
stateDiagram-v2
  [*] --> LOBBY
  LOBBY --> SETUP: host avvia (3..8 giocatori)
  SETUP --> PROCLAMA: distribuzione 5 carte, Megafono scelto
  PROCLAMA --> GIOCA_CARTE: frase annunciata + carta del mazzo piazzata
  GIOCA_CARTE --> RIVELA_TORRE: tutta la Folla ha giocato
  RIVELA_TORRE --> VOTO: carte mescolate, rivelate, numerate
  VOTO --> RISULTATI: Lui! piazzato + tutti hanno votato
  RISULTATI --> CADUTA: rivelazione voti, esito (pareggio -> voto Megafono)
  CADUTA --> PUNTEGGI: punti assegnati
  PUNTEGGI --> FINE_TURNO
  FINE_TURNO --> PROCLAMA: altri turni di Megafono da giocare
  FINE_TURNO --> CLASSIFICA: tutti hanno fatto il Megafono 1 (6-8) / 2 (3-5) volte
  CLASSIFICA --> [*]
```

Eventi di sistema trasversali: disconnessione/riconnessione (la fase attende o applica timeout — da decidere, vedi `ARCHITECTURE.md`), espulsione (solo in LOBBY), abbandono stanza inattiva.
