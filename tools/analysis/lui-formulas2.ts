// Confronto 2: formule in cui il Lui! moltiplica i punti del Megafono. Uso: npx tsx tools/analysis/lui-formulas2.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

type Kind = "CADE" | "NON_CADE";
const hitOf = (k: Kind, fell: boolean) => (k === "CADE" ? fell : !fell);
/** Punti totali del Megafono: others = voti degli ALTRI per carta, v = carta che vota lui, (kind,pos) = Lui!. */
type Pay = (kind: Kind, pos: number, v: number, others: number[]) => number;
function outcome(others: number[], v: number) { const counts = others.map((c, i) => c + (i === v ? 1 : 0)), top = Math.max(...counts); return { counts, top, fallen: counts.flatMap((c, i) => (c === top ? [i] : [])) }; }
const mk = (f: (o: { vFell: boolean; coll: number; hit: boolean; lc: number; lfell: boolean; kind: Kind }) => number): Pay => (kind, pos, v, others) => {
  const o = outcome(others, v), lfell = o.fallen.includes(pos), hit = hitOf(kind, lfell);
  return f({ vFell: o.fallen.includes(v), coll: others[v]!, hit, lc: o.counts[pos]!, lfell, kind });
};
const FORMULAS: { name: string; pay: Pay }[] = [
  { name: "M1 Lui! ×2 (cade e non cade) sui punti del Megafono (voto 2 + voti raccolti) / −1", pay: mk(({ vFell, coll, hit }) => { const base = (vFell ? 2 : 0) + coll; return hit ? 2 * base : base - 1; }) },
  { name: "M5 CADE ×3 / NON CADE ×2 sui punti (voto 2 + raccolti) / −1", pay: mk(({ vFell, coll, hit, kind }) => { const base = (vFell ? 2 : 0) + coll; return hit ? (kind === "CADE" ? 3 : 2) * base : base - 1; }) },
  { name: "M6 CADE ×2 / NON CADE +3 fissi sui punti (voto 2 + raccolti) / −1", pay: mk(({ vFell, coll, hit, kind }) => { const base = (vFell ? 2 : 0) + coll; return hit ? (kind === "CADE" ? 2 * base : base + 3) : base - 1; }) },
  { name: "M7 CADE ×2 / NON CADE ×1,5 (arrotondato) sui punti / −1", pay: mk(({ vFell, coll, hit, kind }) => { const base = (vFell ? 2 : 0) + coll; return hit ? Math.round((kind === "CADE" ? 2 : 1.5) * base) : base - 1; }) },
  { name: "M8 CADE ×2 / NON CADE ×2 ma la scommessa sbagliata costa −2", pay: mk(({ vFell, coll, hit }) => { const base = (vFell ? 2 : 0) + coll; return hit ? 2 * base : base - 2; }) },
  { name: "M9 CADE ×2; NON CADE: nessun moltiplicatore, ma niente penalità se sbaglia", pay: mk(({ vFell, coll, hit, kind }) => { const base = (vFell ? 2 : 0) + coll; return kind === "CADE" ? (hit ? 2 * base : base - 1) : base + (hit ? 1 : 0); }) },
];
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

console.log("Il Megafono sceglie (tipo, carta del Lui!, carta del proprio voto) massimizzando il valore atteso stimato; poi si incassa l'esito reale dei voti degli altri.\n");
for (const n of [4, 6, 8]) {
  const turns = collect(n, 30), T = turns.length;
  console.log(`=== ${n} giocatori · ${T} turni ===`);
  for (const f of FORMULAS) {
    let mega = 0, others = 0, cade = 0, onTop = 0, close = 0, gain = 0, sameCard = 0, zero = 0, hits = 0;
    for (const t of turns) {
      const N = t.p.length, S = Array.from({ length: 120 }, () => sampleOthers(t.p, N - 1));
      const cands: { kind: Kind; pos: number; v: number; ev: number }[] = [];
      for (const kind of ["CADE", "NON_CADE"] as Kind[]) for (let pos = 0; pos < N; pos++) for (let v = 0; v < N; v++) {
        let ev = 0; for (const o of S) ev += f.pay(kind, pos, v, o); cands.push({ kind, pos, v, ev: ev / S.length });
      }
      cands.sort((a, b) => b.ev - a.ev); const best = cands[0]!, second = cands.find((c) => c.kind !== best.kind || c.pos !== best.pos)!;
      const real = (c: { kind: Kind; pos: number; v: number }) => f.pay(c.kind, c.pos, c.v, t.others);
      const rc = cands[Math.floor(rnd() * cands.length)]!, got = real(best);
      mega += got; others += t.othersPts; gain += got - real(rc);
      if (best.kind === "CADE") cade++; if (best.pos === t.p.indexOf(Math.max(...t.p))) onTop++; if (best.v === best.pos) sameCard++; if (got <= 0) zero++; if (got > 0) hits++;
      if (best.ev - second.ev < 0.12 * Math.max(1, Math.abs(best.ev))) close++;
    }
    console.log(`${f.name.padEnd(86)} Megafono ${(mega / T).toFixed(1).padStart(4)} (×${(mega / others).toFixed(1)} vs altri) · CADE ${(100 * cade / T).toFixed(0).padStart(3)}% · Lui! sulla più ovvia ${(100 * onTop / T).toFixed(0).padStart(3)}% · vota la carta del Lui! ${(100 * sameCard / T).toFixed(0).padStart(3)}% · turni a 0 o meno ${(100 * zero / T).toFixed(0).padStart(3)}% · dilemma ${(100 * close / T).toFixed(0).padStart(3)}% · vantaggio su scelta a caso ${(gain / T).toFixed(1)}`);
  }
  console.log("");
}
