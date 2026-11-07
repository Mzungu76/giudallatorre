// Verifica del pool dei segnalini Lui!: per ogni numero di giocatori e ogni coppia estraibile, quanto fa il Megafono e come usa i due segnalini
// (monouso, come nel gioco). Uso: npx tsx tools/analysis/lui-pool.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, luiPool, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

let rs = 23; const rnd = () => { const x = nextRandom(rs); rs = x.state; return x.value; };
interface Turn { game: number; p: number[]; others: number[]; othersPts: number; mega: string; mine: number }
function collect(n: number, games: number): Turn[] {
  const out: Turn[] = [];
  for (let g = 0; g < games; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 7000 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 17 + 3; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0, p: number[] = []; const turnsOf: Record<string, number> = {};
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") { const res = s.lastResult!, m = res.megafonoId, mv = res.votes[m]!;
        const others = Array.from({ length: n }, (_, i) => (res.counts[i + 1] ?? 0) - (i + 1 === mv ? 1 : 0));
        turnsOf[m] = (turnsOf[m] ?? 0) + 1;
        out.push({ game: g, p, others, othersPts: Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1), mega: m, mine: turnsOf[m]! });
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      if (s.phase === "SUSPECT") p = crowdProbs(s, mem, "hard");
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  return out;
}
function sampleOthers(p: number[], n: number) { const c = new Array(p.length).fill(0); for (let i = 0; i < n; i++) { let u = rnd(), k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } c[k]++; } return c; }

for (const n of [3, 4, 5, 6, 8]) {
  const pool = luiPool(n), turns = collect(n, n <= 5 ? 36 : 45), T = turns.length;
  console.log(`=== ${n} giocatori · pool ${pool.map((x) => `${x.slot}→${x.pts}`).join(" ")} · ${T} turni ===`);
  const rows: { name: string; mega: number; vs: number }[] = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const pair = [pool[i]!, pool[j]!], spent = new Map<string, Set<string>>(); let mega = 0, others = 0, hits = 0; const use: Record<string, number> = {};
    for (const t of turns) {
      const key = t.game + "#" + t.mega, sp = spent.get(key) ?? new Set<string>(), left = pair.filter((x) => !sp.has(x.slot)), avail = left.length ? left : pair;
      const N = t.p.length, S = Array.from({ length: 80 }, () => sampleOthers(t.p, N - 1)), top = t.p.indexOf(Math.max(...t.p));
      let best = { tk: avail[0]!, pos: 0, ev: -1 };
      for (const tk of avail) for (let pos = 0; pos < N; pos++) { let ev = 0; for (const o of S) if (tk.slot === "zero" ? o[pos] === 0 : o[pos]! >= tk.k) ev += tk.pts; ev /= S.length; if (ev > best.ev) best = { tk, pos, ev }; }
      const hit = best.tk.slot === "zero" ? t.others[best.pos] === 0 : t.others[best.pos]! >= best.tk.k;
      const vFell = 0.55 * 2; mega += vFell + (hit ? best.tk.pts : 0); others += t.othersPts; if (hit) hits++; use[best.tk.slot] = (use[best.tk.slot] ?? 0) + 1;
      sp.add(best.tk.slot); if (pair.every((x) => sp.has(x.slot))) sp.clear(); spent.set(key, sp); void top;
    }
    rows.push({ name: pair.map((x) => `${x.slot}(${x.pts})`).join(" + "), mega: mega / T, vs: mega / others });
    console.log(`  ${pair.map((x) => `${x.slot}→${x.pts}`).join(" + ").padEnd(22)} Megafono ${(mega / T).toFixed(1)} (×${(mega / others).toFixed(1)}) · azzecca ${(100 * hits / T).toFixed(0)}% · usati ${Object.entries(use).map(([k, v]) => `${k}:${(100 * v / T).toFixed(0)}%`).join(" ")}`);
  }
  const m = rows.map((r) => r.mega); console.log(`  → Megafono tra ${Math.min(...m).toFixed(1)} e ${Math.max(...m).toFixed(1)} a seconda della coppia\n`);
}
