// Genera la Torre del giorno: un solo turno già pronto (carte sulla torre, frase, segnalino piazzato in modo interessante, voti dei bot nascosti).
// Uso: npx tsx tools/oggi/genera.ts --prepara 3        prepara oggi e i prossimi 3 giorni (data di Roma) se mancano: public/oggi/AAAA-MM-GG.json
//      npx tsx tools/oggi/genera.ts --riserva 40       (una tantum) riserva di Torri per le altre partite dello stesso giorno: public/oggi/riserva/N.json
//      npx tsx tools/oggi/genera.ts --indice           riscrive public/oggi/indice.json
// Il giocatore è la Folla; il Megafono e gli altri due sono bot v2o Difficili. Il seme viene dalla data: stesso giorno = stessa Torre.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { applyAction, buildPhraseDeck, createGame, DEFAULT_AGE_BAND, megafonoOf, nextRandom, luoghiTurno, pregiudizioTurno, stereoVoteFlags } from "../../packages/game-engine/src/index.ts";
import type { Action, GameState } from "../../packages/game-engine/src/index.ts";
import { makeAgent, resolveStyles } from "../../packages/ai-lab/src/agents.ts";
import { ACCUSE_DECK, CONFESSIONS, DECK, PHRASE_POOL } from "../../worker/src/content.ts";

const OUT = "public/oggi", INIZIO = "2026-11-16";
const arg = (k: string) => { const i = process.argv.indexOf("--" + k); return i < 0 ? null : process.argv[i + 1] ?? ""; };
const romeDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
const addDays = (day: string, n: number) => { const [y, m, dd] = day.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, dd! + n, 12)).toISOString().slice(0, 10); };
const hash = (t: string) => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; };
const stream = (seed: number) => { let r = seed | 0; return () => { const x = nextRandom(r); r = x.state; return x.value; }; };
const SEATS = [{ engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }, { engine: "v2o", level: "hard" as const }];
const IDS = ["p1", "p2", "p3", "p4"], TYPES = ["cade", "nulli", "noncade"] as const;
/** Una Torre = lo stato del motore al momento del voto (frase, carte sulla torre, segnalino posato, voti dei bot già dati): l'app lo mostra con le schermate di gioco di sempre e applica il voto del giocatore. */
export interface Giorno { v: 2; n: number; umano: string; giocatori: { id: string; nickname: string; char: number; isBot: boolean }[]; stato: GameState; /** Per ogni voto possibile del giocatore: le statistiche dei luoghi comuni del turno (come in una partita normale), calcolate qui perché le etichette restano sul server. */ stereo: Record<number, NonNullable<GameState["stereo"]>> }

function giorno(n: number, seed: number): Giorno {
  const rand = stream(seed ^ 0x9e3779b9), shared = new Map(), styles = resolveStyles(SEATS, stream(seed ^ 0xc2b2ae35)), agents = SEATS.map((s, i) => makeAgent(s, styles[i]!, shared));
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
    const esiti: Record<number, { pts: number }> = {}, stereo: Record<number, NonNullable<GameState["stereo"]>> = {};
    for (const v of pos) {
      const fin = applyAction(pre, { type: "vote", playerId: HUMAN, position: v }).state, r = fin.lastResult!; esiti[v] = { pts: r.points[HUMAN]! };
      const f = stereoVoteFlags(pre.tower, pre.phrase!.text, r.votes), g = pregiudizioTurno(pre.tower, pre.phrase!.text, r.votes, r.marks?.[0]?.position);   // come RoomCore.markStereo
      const L = f && luoghiTurno(pre.tower, pre.phrase!.text, r.votes, r.marks ?? [], r.fallenPositions); if (f && L) { f.cause = L.pesi; f.lancio = L.lancio; }
      const aspC = L ? L.aspetti : undefined, detC = L ? L.dettagli : undefined;
      if (f && g) { const st: NonNullable<GameState["stereo"]> = { n: {}, s: {}, c: g.caso, turni: 1, cause: { ...f.cause }, ...(aspC && Object.keys(aspC).length ? { asp: aspC } : {}), ...(detC && Object.keys(detC).length ? { det: detC } : {}), ...(L && Object.keys(L.pesi).length ? { scene: [{ t: pre.phrase!.text, c: L.scena.c, v: { ...r.votes }, m: (r.marks ?? []).map((x) => ({ p: x.position, e: x.effect })), f: r.fallenPositions.slice(), e: L.scena.e }] } : {}) };
        for (const [pid, p] of Object.entries(g.voti)) { st.n[pid] = 1; st.s[pid] = p; }
        if (g.lui !== null) { st.n[mega] += 1; st.s[mega] += g.lui; }
        if (f.lancio && f.lancio.n >= 2) { const c = pre.tower.find((x) => x.position === f.lancio!.pos); if (c) st.lancio = { cardId: c.cardId, causa: f.lancio.causa, n: f.lancio.n, text: pre.phrase!.text }; }
        stereo[v] = st; }
    }
    const pts = pos.map((v) => esiti[v]!.pts), mx = Math.max(...pts), mn = Math.min(...pts), win = pos.filter((v) => esiti[v]!.pts === mx);
    const obvious = Object.values(votes).sort((a, b) => Object.values(votes).filter((x) => x === b).length - Object.values(votes).filter((x) => x === a).length)[0];
    // «interessante»: i voti rendono cose molto diverse, c'è una sola scelta migliore, e non è la più ovvia (il segnalino o la carta più votata dai bot)
    const score = Math.min(mx - mn, 4) + (win.length === 1 ? 2 : -3) + (win.length === 1 && win[0] !== p ? 6 : 0) + (win.length === 1 && win[0] !== obvious ? 2 : 0) + (type === pref ? 2 : 0) + (Object.values(stereo).some((x) => Object.keys(x.cause).length > 0 || x.lancio) ? 2 : 0) + rand() * 0.5;   // meglio se le statistiche dei luoghi comuni hanno qualcosa da dire
    if (!best || score > best.score) {
      const stato: GameState = { ...pre, drawPile: [], discardPile: [], phraseDraw: [], phraseDiscard: [], totalTurns: 1, rounds: 1 };   // solo ciò che serve a questo turno
      best = { score, g: { v: 2, n, umano: HUMAN, giocatori: IDS.map((id) => ({ id, nickname: id === HUMAN ? "Tu" : ["Ada", "Teo", "Gea"][others.indexOf(id)]!, char: IDS.indexOf(id), isBot: id !== HUMAN })), stato, stereo } };
    }
  }
  }
  return best!.g;
}

const indice = () => {
  mkdirSync(OUT, { recursive: true });
  const date = readdirSync(OUT).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
  const riserva = existsSync(`${OUT}/riserva`) ? readdirSync(`${OUT}/riserva`).filter((f) => /^\d+\.json$/.test(f)).length : 0;
  writeFileSync(`${OUT}/indice.json`, JSON.stringify({ inizio: INIZIO, date, riserva }) + "\n"); console.log(`indice: ${date.length} giorni, riserva ${riserva}`);
};
if (arg("riserva") !== null) { const N = Number(arg("riserva")); mkdirSync(`${OUT}/riserva`, { recursive: true }); for (let n = 0; n < N; n++) writeFileSync(`${OUT}/riserva/${n}.json`, JSON.stringify(giorno(n, 9100 + n * 7919))); indice(); }
else if (arg("prepara") !== null) {
  const oggi = romeDay(new Date()), N = Number(arg("prepara") || 3); mkdirSync(OUT, { recursive: true }); let nuove = 0;
  for (let k = 0; k <= N; k++) { const day = addDays(oggi, k), f = `${OUT}/${day}.json`; if (existsSync(f)) continue; writeFileSync(f, JSON.stringify(giorno(Math.max(1, Math.round((Date.parse(day) - Date.parse(INIZIO)) / 86_400_000) + 1), hash("torre-" + day)))); console.log("preparata", day); nuove++; }
  console.log(nuove ? `preparate ${nuove} Torri` : "niente da preparare"); indice();
} else indice();
