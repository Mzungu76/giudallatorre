# AI_RESEARCH — ricerca bibliografica per lo Strategic AI Engine

Stato: **Fase 1, prima stesura (2026-11-15)**. Le tecniche sono valutate sul gioco reale («Cade / Non cade», vedi `GAME_RULES.md`), non in astratto.

## Come è stata fatta la verifica (e i suoi limiti)
- Metadati (autori, anno, sede, DOI, pagine) verificati con ricerca web su schede ufficiali: arXiv, PMLR, NeurIPS, IJCAI, RePEc, repository universitari.
- **Non ho potuto leggere i testi integrali**: dal container l'accesso diretto ad arXiv, DOI, editori è bloccato dal proxy. Dove sotto scrivo «dall'abstract» il contenuto viene dalla scheda ufficiale; dove scrivo «valutazione» è un mio giudizio di applicabilità, **da rivedere dopo la lettura del testo integrale** (da fare con accesso aperto, o a cura dell'utente).
- Nessun risultato sperimentale degli articoli è stato riportato oltre a quelli letti negli abstract. Nessuna affermazione sulle prestazioni di un algoritmo in *questo* gioco: quelle si dimostrano nell'AI Laboratory (`AI_BENCHMARKS.md`).

## Il gioco, dal punto di vista della teoria dei giochi
| Proprietà | In Giù dalla Torre |
|---|---|
| Informazione | **Imperfetta**: mani, carte giocate, voti e segnalino sono nascosti. |
| Mosse | **Simultanee** nascoste: tutti giocano una carta insieme; tutti votano insieme. Il Megafono posa il segnalino *prima* dei voti, in sequenza. |
| Giocatori | 3–8, **general-sum** (non a somma zero: i punti non sono conservati). Obiettivo reale: **vincere** (rango), non massimizzare i punti. |
| Orizzonte | Breve: 3–8 turni (6 con 3 giocatori), più eventuale golden goal. |
| Ramificazione | Piccola: voto ≤ 8 opzioni, segnalino 3 × N posizioni, carta ≤ 5. |
| Componente semantica | Il gruppo vota ciò che *sembra* più adatto alla frase: giudizio umano, non osservabile. I bot lo approssimano con etichette nascoste (`tags.ts`). |
| Memoria tra partite | Nessuna oggi. |

Conseguenze: (1) il problema centrale è **prevedere il voto del gruppo** e leggere i singoli avversari; (2) l'orizzonte breve rende inutile un albero profondo, mentre servono stime di **probabilità di vittoria**; (3) con 3+ giocatori general-sum il concetto di equilibrio di Nash perde la garanzia di sicurezza dei giochi a somma zero a due giocatori (valutazione mia: da verificare sul testo di Zinkevich et al. e sulla letteratura sui giochi multigiocatore).

## Bibliografia

### A. Opponent modelling
1. **Albrecht, S. V., Stone, P. (2018).** *Autonomous Agents Modelling Other Agents: A Comprehensive Survey and Open Problems.* Artificial Intelligence 258:66–95. DOI 10.1016/j.artint.2018.01.002. arXiv:1709.08071. — *Dall'abstract/scheda:* survey dei metodi di modellazione di altri agenti; categorie: ricostruzione della politica, ragionamento per tipi, classificazione, riconoscimento di piani, ragionamento ricorsivo, modelli grafici, modellazione di gruppo. **Priorità massima.** Fonte della scelta di **type-based reasoning bayesiano** + ricostruzione della politica con statistiche (vedi «Tecniche selezionate»).

### B. Monte Carlo Tree Search
2. **Świechowski, M., Godlewski, K., Sawicki, B., Mańdziuk, J. (2023).** *Monte Carlo Tree Search: a review of recent modifications and applications.* Artificial Intelligence Review 56(3):2497–2562. DOI 10.1007/s10462-022-10228-y. arXiv:2103.04931. — *Dall'abstract:* rassegna delle modifiche specifiche per dominio e degli approcci ibridi dopo la survey del 2012.
3. **Tak, M. J. W., Lanctot, M., Winands, M. H. M. (2014).** *Monte Carlo Tree Search Variants for Simultaneous Move Games.* IEEE CIG 2014, pp. 232–239. DOI 10.1109/CIG.2014.6932889. — *Dall'abstract:* confronta Decoupled UCT, Sequential UCT, Exp3 e Regret Matching su nove giochi a mosse simultanee; Decoupled UCT risulta il migliore complessivamente «nonostante i limiti teorici». **Massima priorità** (voti simultanei).
4. **Cowling, P. I., Powley, E. J., Whitehouse, D. (2012).** *Information Set Monte Carlo Tree Search.* IEEE Trans. Computational Intelligence and AI in Games 4(2):120–143. DOI 10.1109/TCIAIG.2012.2200894. — *Dall'abstract:* ISMCTS cerca su alberi di *insiemi informativi*; segnala che la determinizzazione tratta stati dello stesso insieme informativo come distinti. *Non è nell'elenco del prompt:* aggiunta perché il gioco ha informazione nascosta. Il confronto determinizzazione/ISMCTS serve al nostro campionamento dei mondi possibili.

### C. Livelli cognitivi e risposta probabilistica
5. **Camerer, C. F., Ho, T.-H., Chong, J.-K. (2004).** *A Cognitive Hierarchy Model of Games.* Quarterly Journal of Economics 119(3):861–898. DOI 10.1162/0033553041502225. — *Dall'abstract:* i giocatori di livello 0 randomizzano; il livello *k* risponde in modo ottimo assumendo che gli altri siano distribuiti sui livelli 0…k−1; con distribuzione di Poisson, in media ~1,5 livelli spiegano i dati di molti giochi. **Priorità massima:** base teorica dei tre livelli di difficoltà.
6. **McKelvey, R. D., Palfrey, T. R. (1995).** *Quantal Response Equilibria for Normal Form Games.* Games and Economic Behavior 10(1):6–38. DOI 10.1006/game.1995.1023. — Equilibrio in cui i giocatori scelgono con probabilità crescente col valore atteso (risposta logit/«quantal»). Fonte del rumore calibrato (softmax con temperatura) che i bot già usano.

### D. Counterfactual Regret Minimization
7. **Zinkevich, M., Johanson, M., Bowling, M., Piccione, C. (2007/2008).** *Regret Minimization in Games with Incomplete Information.* Advances in NIPS 20 (NIPS 2007; volume 2008). — *Dall'abstract:* introduce il rimpianto controfattuale: minimizzarlo minimizza il rimpianto complessivo e, in self-play, calcola un equilibrio di Nash; testato su astrazioni del poker (fino a 10¹² stati). *Nota bibliografica:* le fonti discordano sulle pagine (905–912 oppure 1729–1736); il prompt cita «2008», la conferenza è NIPS 2007.
8. **Brown, N., Lerer, A., Gross, S., Sandholm, T. (2019).** *Deep Counterfactual Regret Minimization.* ICML 2019, PMLR 97:793–802. — *Dall'abstract:* CFR con reti neurali senza astrazione; convergenza dimostrata in giochi a somma zero a due giocatori. **Sperimentale**, non adottato.

### E. Giochi di deduzione sociale
9. **Serrino, J., Kleiman-Weiner, M., Parkes, D. C., Tenenbaum, J. B. (2019).** *Finding Friend and Foe in Multi-Agent Games.* NeurIPS 2019; arXiv:1906.02330. — *Dall'abstract:* DeepRole = CFR + reti di valore addestrate in self-play + deduzione sulle azioni nascoste, su The Resistance: Avalon; in partite online con umani supera i giocatori umani. *Nota:* il titolo del prompt («…in Avalon with CFR and Deep Networks») è quello della tesi di master al MIT; l'articolo pubblicato ha il titolo qui riportato.
10. **Brandizzi, N., Grossi, D., Iocchi, L. (2021).** *RLupus: Cooperation through Emergent Communication in The Werewolf Social Deduction Game.* Intelligenza Artificiale 15(2):55–70. DOI 10.3233/IA-210081 (arXiv:2106.05018). — Apprendimento per rinforzo multi-agente con segnale di comunicazione. **Poco pertinente**: Giù dalla Torre non ha ruoli cooperativi né comunicazione codificata.

### F. Evoluzione delle strategie
11. **Lanctot, M. et al. (2017).** *A Unified Game-Theoretic Approach to Multiagent Reinforcement Learning.* NeurIPS 2017; arXiv:1711.00832. — *Dall'abstract:* introduce **PSRO** (oracoli di best response su politiche, con meta-strategie calcolate da analisi empirica dei giochi) e la metrica *joint-policy correlation* per il sovradattamento. *Aggiunta al prompt:* è l'articolo originale dei PSRO.
12. **Bighashdel, A., Wang, Y., McAleer, S., Savani, R., Oliehoek, F. A. (2024).** *Policy Space Response Oracles: A Survey.* IJCAI-24 Survey Track, pp. 7951–7961. DOI 10.24963/ijcai.2024/880; arXiv:2403.02227. — Rassegna su efficienza, esplorazione delle strategie e applicazioni dei PSRO.
13. **Li, Z., Lanctot, M., McKee, K. R., Marris, L., Gemp, I., Hennes, D., Muller, P., Larson, K., Bachrach, Y., Wellman, M. P. (2025).** *Combining Deep Reinforcement Learning and Search with Generative Models for Game-Theoretic Opponent Modeling.* IJCAI-25, pp. 161–169. DOI 10.24963/ijcai.2025/19. — *Dall'abstract:* GenBR (best response con modello generativo dei mondi nascosti) usato dentro PSRO per un modello offline degli avversari e aggiornato online con apprendimento bayesiano; testato in Deal-or-No-Deal con umani. *Nota:* l'ultima versione su arXiv (2302.00797) ha un altro titolo. **Sperimentale.**

### G. Reinforcement learning e strumenti
14. **Sutton, R. S., Barto, A. G. (2018).** *Reinforcement Learning: An Introduction*, 2ª ed., MIT Press. Riferimento di base (non consultato per intero qui).
15. **Lanctot, M. et al. (2019).** *OpenSpiel: A Framework for Reinforcement Learning in Games.* arXiv:1908.09453. — *Dall'abstract:* raccolta di ambienti e algoritmi per RL e ricerca/pianificazione in giochi (informazione perfetta/imperfetta, mosse simultanee, giochi in forma normale). Usato come **riferimento per verificare le nostre implementazioni** (es. regret matching), non come dipendenza: è C++/Python e non è eseguibile in un Worker.
16. **PettingZoo (Farama), RLlib (Ray), PyTorch:** *non consultati in questa fase* (docs ufficiali: da verificare). Esclusi dal motore di gioco (vedi sotto); possibili solo nel laboratorio di addestramento.

## Tecniche selezionate (con motivazioni)
| # | Tecnica | Problema che risolve qui | Presupposti | Compatibilità | Costo | Limiti | Dove |
|---|---|---|---|---|---|---|---|
| S1 | **Valutazione per rango / probabilità di vittoria** (Monte Carlo del resto della partita) | Il bot oggi massimizza il valore atteso dei punti del turno; il prompt chiede la vittoria | Politica veloce di rollout per tutti i giocatori; orizzonte ≤ 8 turni | Piena | O(rollout × turni × decisioni) → va entro un budget in ms | Il rollout dipende dal modello degli avversari | Strategic Evaluator |
| S2 | **Opponent model bayesiano per giocatore** (Albrecht & Stone: ragionamento per tipi + ricostruzione della politica) | Oggi la memoria è solo sulle carte, non sui giocatori | Parametri comportamentali stimabili (es. P(vota la propria carta), temperatura di scelta, tasso di bluff) con prior debole | Piena; poche osservazioni a partita (≤ 8 voti per giocatore) | Trascurabile (aggiornamenti Beta/Dirichlet) | Pochi dati: serve riduzione verso il prior e decadimento | Opponent Modeling |
| S3 | **Cognitive Hierarchy come livelli di difficoltà** (Camerer et al.) | Medio e Difficile oggi si equivalgono (BOTS.md) | Livello 0 = gruppo «naturale» con rumore; livello k = best response a livelli < k | Piena | Cresce con k | Il parametro τ di Poisson va tarato | Difficulty Manager |
| S4 | **Risposta quantale (logit)** (McKelvey & Palfrey) | Errori realistici e imprevedibilità senza casualità arbitraria | Utilità note → probabilità softmax | Già in uso (`softmax`/TUNE) | Nulla | La temperatura va stimata per giocatore | Prediction + Difficulty |
| S5 | **Mondi possibili campionati dalla credenza** (determinizzazione; ISMCTS come confronto) | Le carte altrui sono nascoste | Distribuzione sulle mani/proprietari coerente con le informazioni pubbliche | Piena | Lineare nei campioni | Determinizzazione ignora la differenza tra stati dello stesso insieme informativo (Cowling et al.); a questo orizzonte probabilmente trascurabile: **da misurare** | Simulation |
| S6 | **Turno come gioco in forma normale simultaneo** + **regret matching / Exp3** (Tak et al.) | Voti e carte simultanei: l'albero sequenziale è scorretto | Matrice dei payoff stimata per campionamento | Piena, per il sottogioco (segnalino × voto) | Piccolo (≤ 8×24 azioni) | In giochi general-sum a più giocatori non converge a un «equilibrio sicuro»; serve come strategia mista robusta, non come garanzia | Simulation, solo livello Difficile |
| S7 | **Popolazione di agenti + EGTA / PSRO parametrico** | Misurare robustezza e sfruttabilità; migliorare nel tempo | Un'astrazione della strategia in poche decine di parametri | Piena (offline) | Solo nel laboratorio | Se la popolazione è solo di bot, rischio di sovradattamento (JPC, Lanctot et al.) | AI Laboratory |

Principio guida (dal prompt, §18): **partire dalla soluzione più semplice**; ogni tecnica entra solo se il laboratorio misura un miglioramento con intervalli di confidenza.

## Tecniche escluse o rimandate
| Tecnica | Decisione | Motivo |
|---|---|---|
| **MCTS ad albero profondo** (UCT) | Esclusa come ricerca principale | Orizzonte decisionale di 1 turno con ≤ 24 azioni: un albero non aggiunge nulla a un campionamento diretto; costo CPU alto con 10 ms/richiesta (COSTS.md). Sua versione *decoupled* resta come confronto in laboratorio. |
| **CFR / MCCFR sull'intero gioco** | Esclusa | Spazio informativo enorme (mani × frasi × giudizi umani); la parte semantica non è modellabile nel formalismo; nessuna garanzia in general-sum a più giocatori. Possibile solo sul sottogioco bluff/segnalino come confronto. |
| **Deep CFR, DeepRole, GenBR** | Rimandati | Reti neurali: il prompt le ammette solo con vantaggio dimostrato; servirebbero dati di partite umane che oggi non esistono. Riconsiderare dopo la raccolta di dati. |
| **RLlib / PettingZoo / PyTorch** | Esclusi dal motore | Dipendenze Python pesanti; il motore deve girare in un Worker. Ammissibili solo come strumenti offline. |
| **OpenSpiel come dipendenza** | Esclusa; usata come riferimento | Non eseguibile nell'ambiente del gioco; si usa per controllare incrociando le implementazioni. |
| **RLupus** | Non applicabile | Cooperazione con comunicazione emergente: assente qui. |

## Rischi di validità da tenere presenti
1. **Circolarità**: se la «folla» simulata usa le stesse etichette dei bot, un miglioramento può essere un artefatto. Contromisura: popolazioni di folle con modelli di percezione diversi (etichette degradate/perturbate) e, appena possibile, dati di umani.
2. **Misura reale ≠ ipotesi teorica**: un esempio già incontrato (vedi `AI_BENCHMARKS.md`): la correzione «ovvia» del valore del NON CADE peggiora i bot di 0,75 punti a partita. Ogni modifica va misurata.
3. **Giocatori umani**: i criteri di accettazione richiedono test con persone; nessun bot-vs-bot li sostituisce.

## Riferimenti alle implementazioni (aggiornato a ogni fase)
- Valutazione a un passo, softmax/QRE: `packages/game-engine/src/ai.ts` (`cncPlace`, `cncVote`, `TUNE`).
- Punteggio di turni ipotetici (per S1, S5, S6): `packages/game-engine/src/scoring.ts` (`scoreTurn`, equivalente a `resolve()` per test).
- Osservazione e azioni legali (confine di fair play): `src/observation.ts`; interfaccia dei motori: `packages/strategic-ai/src/api.ts`.
- Baseline congelata e registro versioni: `src/ai-baseline/ai.ts`, `src/bot-engines.ts`.
- Confronto versioni (precursore del laboratorio): `tools/analysis/engine-compare.ts`.
- S2/S4 (opponent model bayesiano per tipi, risposta quantale) e previsione dei voti: `packages/strategic-ai/src/opponents/` (Fase 4; `AI_ALGORITHMS.md`, misure in `AI_BENCHMARKS.md` §5). Scelta: ragionamento per tipi (Albrecht & Stone) con griglia (λ, ε) e pesi di popolazione stimati con EM; coefficienti liberi per giocatore misurati e scartati come predefiniti (troppo pochi dati per partita).
- S5/S6 (simulazione di turni a mosse simultanee, scelta mista): `packages/strategic-ai/src/sim/` e `engines/strategic.ts` (Fase 5). Il turno è trattato come gioco a mosse simultanee con campionamento dei voti dal modello, non come albero sequenziale; regret matching/Exp3 non implementati (la scelta mista è una risposta quantale), da confrontare in Fase 9. S1 (probabilità di vittoria) è stato provato in forma semplice e non ha battuto i punti attesi.
- S3 (livelli come gerarchia cognitiva), S7: **non ancora implementati**.
