// Genera «La Torre del giorno»: un solo turno già pronto (carte sulla torre, frase, segnalino piazzato in modo interessante) e l'esito per ognuno dei 4 voti possibili.
// Uso: npx tsx tools/oggi/genera.ts [giorni=120] [inizio=2026-11-16]   → public/oggi/indice.json + public/oggi/<n>.json
// Il giocatore è la Folla (p2); il Megafono (p1) e gli altri due (p3, p4) sono bot v2o Difficili. Tutto è deterministico (stesso seme = stessa Torre).
import { mkdirSync, writeFileSync } from "node:fs";
import { applyAction, buildPhraseDeck, createGame, DEFAULT_AGE_BAND, megafonoOf, nextRandom } from "../../packages/game-engine/src/index.ts";
import type { Action, GameState } from "../../packages/game-engine/src/index.ts";
import { makeAgent, resolveStyles } from "../../packages/ai-lab/src/agents.ts";
import { ACCUSE_DECK, CONFESSIONS, DECK, PHRASE_POOL } from "../../worker/src/content.ts";

const N = Number(process.argv[2] ?? 120), START = process.argv[3] ?? "2026-11-16", OUT = "public/oggi";
const stream = (seed: number) => { let r = seed | 0; return () => { const x = nextRandom(r); r = x.state; return x.value; }; };
const SEATS = [{ engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }];
const IDS = ["p1", "p2", "p3", "p4"], TYPES = ["cade", "nulli", "noncade"] as const;
/** Una Torre = lo stato del motore al momento del voto (frase, carte sulla torre, segnalino posato, voti dei bot già dati): l'app lo mostra con le schermate di gioco di sempre e applica il voto del giocatore. */
export interface Giorno { v: 2; n: number; umano: string; giocatori: { id: string; nickname: string; char: number; isBot: boolean }[]; stato: GameState }

function giorno(n: number): Giorno {
  const seed = 9100 + n * 7919, rand = stream(seed ^ 0x9e3779b9), shared = new Map(), styles = resolveStyles(SEATS, stream(seed ^ 0xc2b2ae35)), agents = SEATS.map((s, i) => makeAgent(s, styles[i]!, shared));
  let s: GameState = createGame({ players: IDS.map((id, i) => ({ id, name: "P" + (i + 1) })), seed, deck: DECK, phraseDeck: buildPhraseDeck(PHRASE_POOL!, CONFESSIONS, { age: DEFAULT_AGE_BAND, seed: seed ^ 0x5bd1e995, confessions: false }), miniGame: false, accuseDeck: ACCUSE_DECK }).state;
  for (let g = 0; s.phase !== "SUSPECT" && g < 40; g++) {   // frase e carte sulla torre: tutti decidono dallo stesso stato e poi si applica
    const snap = s; for (let i = 0; i < 4; i++) { const a = agents[i]!.decide(snap, IDS[i]!, rand); if (a) s = applyAction(s, a).state; }
  }
  if (s.phase !== "SUSPECT") throw new Error(`giorno ${n}: la fase è ${s.phase}`);
  const mega = megafonoOf(s), HUMAN = mega === "p2" ? "p3" : "p2", others = IDS.filter((x) => x !== HUMAN);
  const pos = s.tower.map((t) => t.position).sort((a, b) => a - b), pref = TYPES[n % 3]!;
  let best: { score: number; g: Giorno } | null = null;
  for (const types of [[pref], TYPES]) { if (best && best.score >= 9) break;   // il tipo del giorno a rotazione; se non dà una Torre interessante si prova anche gli altri
  for (const type of types) for (const p of pos) {   // ogni giorno un tipo di segnalino diverso, a rotazione
    
    const m = applyAction(s, { type: "placeMarks", playerId: mega, marks: [{ slot: type, position: p }] } as Action).state, votes: Record<string, number> = {};
    for (const id of others) { const a = agents[IDS.indexOf(id)]!.decide(m, id, rand); if (a?.type === "vote") votes[id] = a.position; }
    let pre = m; for (const [id, vv] of Object.entries(votes)) pre = applyAction(pre, { type: "vote", playerId: id, position: vv }).state;   // manca solo il voto del giocatore
    const esiti: Record<number, { pts: number }> = {};
    for (const v of pos) esiti[v] = { pts: applyAction(pre, { type: "vote", playerId: HUMAN, position: v }).state.lastResult!.points[HUMAN]! };
    const pts = pos.map((v) => esiti[v]!.pts), mx = Math.max(...pts), mn = Math.min(...pts), win = pos.filter((v) => esiti[v]!.pts === mx);
    const obvious = Object.values(votes).sort((a, b) => Object.values(votes).filter((x) => x === b).length - Object.values(votes).filter((x) => x === a).length)[0];
    // «interessante»: i voti rendono cose molto diverse, c'è una sola scelta migliore, e non è la più ovvia (il segnalino o la carta più votata dai bot)
    const score = Math.min(mx - mn, 4) + (win.length === 1 ? 2 : -3) + (win.length === 1 && win[0] !== p ? 6 : 0) + (win.length === 1 && win[0] !== obvious ? 2 : 0) + (type === pref ? 2 : 0) + rand() * 0.5;
    if (!best || score > best.score) {
      const stato: GameState = { ...pre, drawPile: [], discardPile: [], phraseDraw: [], phraseDiscard: [], totalTurns: 1, rounds: 1 };   // solo ciò che serve a questo turno
      best = { score, g: { v: 2, n, umano: HUMAN, giocatori: IDS.map((id) => ({ id, nickname: id === HUMAN ? "Tu" : ["Ada", "Teo", "Gea"][others.indexOf(id)]!, char: IDS.indexOf(id), isBot: id !== HUMAN })), stato } };
    }
  }
  }
  return best!.g;
}

mkdirSync(OUT, { recursive: true });
for (let n = 0; n < N; n++) { const g = giorno(n); writeFileSync(`${OUT}/${n}.json`, JSON.stringify(g)); if (n % 10 === 0) console.log(`giorno ${n}/${N}`); }
writeFileSync(`${OUT}/indice.json`, JSON.stringify({ inizio: START, giorni: N }) + "\n");
console.log(`fatto: ${N} Torri in ${OUT}`);
