// Segnalini Lui! numerati (scommessa sul numero di voti sulla carta). Uso: npx tsx tools/analysis/lui-numerati.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

/** Segnalini numerati: il Megafono posa il numero k su una carta e scommette che prenda almeno k voti. */
type Pay = (k: number, pos: number, v: number, others: number[], n: number) => number;
const F: { name: string; hit: (k: number, n: number) => number; miss: number }[] = [
  { name: "L1 10 punti fissi se azzecca, 0 se no", hit: () => 10, miss: 0 },
  { name: "L2 2 × k se azzecca, 0 se no", hit: (k) => 2 * k, miss: 0 },
  { name: "L3 3 × k se azzecca, 0 se no", hit: (k) => 3 * k, miss: 0 },
  { name: "L4 k² se azzecca, 0 se no", hit: (k) => k * k, miss: 0 },
  { name: "L5 2 × k se azzecca, −1 se no", hit: (k) => 2 * k, miss: -1 },
  { name: "L6 k + 2 se azzecca, 0 se no", hit: (k) => k + 2, miss: 0 },
  { name: "L7 2 × k − 1 se azzecca, −2 se no", hit: (k) => 2 * k - 1, miss: -2 },
];
const COLLECT = process.env.COLLECT !== "0";
const mkPay = (f: (typeof F)[number]): Pay => (k, pos, v, others) => {
  const counts = others.map((c, i) => c + (i === v ? 1 : 0)), top = Math.max(...counts), vFell = counts[v] === top;
  const got = counts[pos]! >= k;
  return (vFell ? 2 : 0) + (COLLECT ? others[v]! : 0) + (got ? f.hit(k, others.length) : f.miss);
};
interface Turn { n: number; p: number[]; others: number[]; othersPts: number }
function collect(n: number, games: number): Turn[] {
  const out: Turn[] = [];
  for (let g = 0; g < games; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 3000 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 11 + 5; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0, p: number[] = [];
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") { const res = s.lastResult!, m = res.megafonoId, mv = res.votes[m]!;
        const others = Array.from({ length: n }, (_, i) => (res.counts[i + 1] ?? 0) - (i + 1 === mv ? 1 : 0));
        const othersPts = Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        out.push({ n, p, others, othersPts }); learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      if (s.phase === "SUSPECT") p = crowdProbs(s, mem, "hard");
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  return out;
}
let rs = 17; const rnd = () => { const x = nextRandom(rs); rs = x.state; return x.value; };
function sampleOthers(p: number[], n: number) { const c = new Array(p.length).fill(0); for (let i = 0; i < n; i++) { let u = rnd(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } c[k]++; } return c; }

console.log("Il Megafono sceglie (numero k, carta, proprio voto) massimizzando il valore atteso stimato; poi si incassa l'esito reale. Totale Megafono = voto 2 (+ 1 per voto raccolto se COLLECT≠0) + segnalino.\n");
for (const n of [4, 6, 8]) {
  const turns = collect(n, 30), T = turns.length;
  console.log(`=== ${n} giocatori · ${T} turni ===`);
  for (const f of F) {
    const pay = mkPay(f);
    let mega = 0, others = 0, hits = 0, gain = 0, kSum = 0, kMax = 0, kOne = 0, onTop = 0, close = 0, sameCard = 0; const kh: Record<number, number> = {};
    for (const t of turns) {
      const N = t.p.length, S = Array.from({ length: 100 }, () => sampleOthers(t.p, N - 1));
      const cands: { k: number; pos: number; v: number; ev: number }[] = [];
      for (let k = 1; k <= N; k++) for (let pos = 0; pos < N; pos++) for (const v of [pos, t.p.indexOf(Math.max(...t.p))]) {
        let ev = 0; for (const o of S) ev += pay(k, pos, v, o, N); cands.push({ k, pos, v, ev: ev / S.length });
      }
      cands.sort((a, b) => b.ev - a.ev); const best = cands[0]!, second = cands.find((c) => c.k !== best.k || c.pos !== best.pos)!;
      const real = (c: { k: number; pos: number; v: number }) => pay(c.k, c.pos, c.v, t.others, N);
      const rc = cands[Math.floor(rnd() * cands.length)]!, got = real(best);
      const counts = t.others.map((c, i) => c + (i === best.v ? 1 : 0));
      mega += got; others += t.othersPts; gain += got - real(rc); if (counts[best.pos]! >= best.k) hits++;
      kSum += best.k; kh[best.k] = (kh[best.k] ?? 0) + 1; if (best.k === N) kMax++; if (best.k === 1) kOne++;
      if (best.pos === t.p.indexOf(Math.max(...t.p))) onTop++; if (best.v === best.pos) sameCard++;
      if (best.ev - second.ev < 0.12 * Math.max(1, Math.abs(best.ev))) close++;
    }
    const dist = Object.keys(kh).map(Number).sort((a, b) => a - b).map((k) => `${k}:${(100 * kh[k]! / T).toFixed(0)}%`).join(" ");
    console.log(`${f.name.padEnd(42)} Megafono ${(mega / T).toFixed(1).padStart(4)} (×${(mega / others).toFixed(1)}) · azzecca ${(100 * hits / T).toFixed(0).padStart(3)}% · k medio ${(kSum / T).toFixed(1)} [${dist}] · sulla più ovvia ${(100 * onTop / T).toFixed(0)}% · dilemma ${(100 * close / T).toFixed(0)}% · vantaggio su scelta a caso ${(gain / T).toFixed(1)}`);
  }
  console.log("");
}
