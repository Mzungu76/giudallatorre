// Segnalini Lui! numerati (scommessa sul numero di voti sulla carta). Uso: npx tsx tools/analysis/lui-numerati.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

interface Turn { n: number; p: number[]; others: number[]; othersPts: number; mega: string; turn: number }
function collect(n: number, games: number): Turn[] {
  const out: Turn[] = [];
  for (let g = 0; g < games; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 3000 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 11 + 5; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0, p: number[] = [];
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") { const res = s.lastResult!, m = res.megafonoId, mv = res.votes[m]!;
        const others = Array.from({ length: n }, (_, i) => (res.counts[i + 1] ?? 0) - (i + 1 === mv ? 1 : 0));
        const othersPts = Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        out.push({ n, p, others, othersPts, mega: m, turn: res.turn }); learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      if (s.phase === "SUSPECT") p = crowdProbs(s, mem, "hard");
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  return out;
}
let rs = 17; const rnd = () => { const x = nextRandom(rs); rs = x.state; return x.value; };
function sampleOthers(p: number[], n: number) { const c = new Array(p.length).fill(0); for (let i = 0; i < n; i++) { let u = rnd(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } c[k]++; } return c; }

// Segnalini monouso: ogni giocatore ha 2 soglie + lo 0; ne spende uno ogni volta che fa il Megafono. Uso: npx tsx tools/analysis/lui-segnalini.ts
const TH: Record<number, [number, number, number]> = { 3: [1, 2, 3], 4: [1, 2, 3], 5: [2, 3, 4], 6: [2, 3, 4], 7: [3, 4, 5], 8: [3, 4, 6] };
type Token = { k: number; pts: number; zero: boolean };
interface Variant { name: string; pick: [number, number]; zeroPts: (n: number) => number }
const V: Variant[] = [
  { name: "A {bassa, alta} + 0 = 3 punti", pick: [0, 2], zeroPts: () => 3 },
  { name: "B {bassa, alta} + 0 = 4 punti", pick: [0, 2], zeroPts: () => 4 },
  { name: "C {bassa, alta} + 0 = 5 punti", pick: [0, 2], zeroPts: () => 5 },
  { name: "D {media, alta} + 0 = 4 punti", pick: [1, 2], zeroPts: () => 4 },
  { name: "E {media, alta} + 0 = 5 punti", pick: [1, 2], zeroPts: () => 5 },
  { name: "F {media, alta} + 0 = 6 punti", pick: [1, 2], zeroPts: () => 6 },
];
const tokensFor = (v: Variant, n: number): Token[] => [...v.pick.map((i) => ({ k: TH[n]![i]!, pts: 2 * TH[n]![i]!, zero: false })), { k: 0, pts: v.zeroPts(n), zero: true }];
const hitTok = (t: Token, c: number) => (t.zero ? c === 0 : c >= t.k);
const tokName = (t: Token) => (t.zero ? "0" : String(t.k));

console.log("Ogni Megafono sceglie (segnalino tra quelli che gli restano, carta, proprio voto) col valore atteso migliore; il segnalino usato è perso. Totale Megafono = voto 2 + segnalino (0 se sbaglia).\n");
for (const n of [3, 5, 6, 8]) {
  const turns = collect(n, n <= 5 ? 24 : 30), T = turns.length;
  console.log(`=== ${n} giocatori · ${T} turni · soglie ${TH[n]!.join("/")} ===`);
  for (const v of V) {
    const spent = new Map<string, Set<string>>(); const use: Record<string, number> = {}; const useBy: Record<number, Record<string, number>> = { 1: {}, 2: {} };
    let mega = 0, others = 0, hits = 0, gain = 0, onTop = 0, zeroHit = 0, zeroUse = 0, per1 = 0, n1 = 0, per2 = 0, n2 = 0;
    for (const t of turns) {
      const N = t.p.length, all = tokensFor(v, N), sp = spent.get(t.mega + "#" + Math.floor(t.turn / 1000)) ?? new Set<string>();
      const avail = all.filter((x) => !sp.has(tokName(x))), toks = avail.length ? avail : all;
      const S = Array.from({ length: 90 }, () => sampleOthers(t.p, N - 1)), top = t.p.indexOf(Math.max(...t.p));
      const pay = (tk: Token, pos: number, vv: number, others: number[]) => { const counts = others.map((c, i) => c + (i === vv ? 1 : 0)), mx = Math.max(...counts); return (counts[vv] === mx ? 2 : 0) + (hitTok(tk, counts[pos]!) ? tk.pts : 0); };
      const cands: { tk: Token; pos: number; vv: number; ev: number }[] = [];
      for (const tk of toks) for (let pos = 0; pos < N; pos++) for (const vv of [pos, top]) { let ev = 0; for (const o of S) ev += pay(tk, pos, vv, o); cands.push({ tk, pos, vv, ev: ev / S.length }); }
      cands.sort((a, b) => b.ev - a.ev); const best = cands[0]!, rc = cands[Math.floor(rnd() * cands.length)]!;
      const got = pay(best.tk, best.pos, best.vv, t.others), counts = t.others.map((c, i) => c + (i === best.vv ? 1 : 0));
      mega += got; others += t.othersPts; gain += got - pay(rc.tk, rc.pos, rc.vv, t.others);
      const ok = hitTok(best.tk, counts[best.pos]!); if (ok) hits++; if (best.pos === top) onTop++;
      const nm = tokName(best.tk); use[nm] = (use[nm] ?? 0) + 1; if (best.tk.zero) { zeroUse++; if (ok) zeroHit++; }
      const mt = ((t.turn - 1) / N | 0) + 1, key = mt === 1 ? 1 : 2; (useBy[key] ??= {})[nm] = ((useBy[key] ??= {})[nm] ?? 0) + 1; if (key === 1) { per1 += got; n1++; } else { per2 += got; n2++; }
      sp.add(nm); spent.set(t.mega + "#" + Math.floor(t.turn / 1000), sp);
    }
    const fmt = (o: Record<string, number>, tot: number) => Object.keys(o).sort().map((k) => `${k}:${(100 * o[k]! / tot).toFixed(0)}%`).join(" ");
    console.log(`${v.name.padEnd(40)} Megafono ${(mega / T).toFixed(1).padStart(4)} (×${(mega / others).toFixed(1)}) · azzecca ${(100 * hits / T).toFixed(0)}% · segnalini usati [${fmt(use, T)}] · 0: usato ${(100 * zeroUse / T).toFixed(0)}%${zeroUse ? ` azzeccato ${(100 * zeroHit / zeroUse).toFixed(0)}%` : ""} · 1° turno ${n1 ? (per1 / n1).toFixed(1) : "-"}${n2 ? ` · 2° turno ${(per2 / n2).toFixed(1)}` : ""} · vantaggio su scelta a caso ${(gain / T).toFixed(1)}`);
  }
  console.log("");
}
