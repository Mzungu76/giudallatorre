// Confronto regole di pareggio: oggi (cadono tutte le carte in testa a pari merito) contro "le carte con punteggio uguale si salvano e si valutano solo le restanti". Uso: npx tsx tools/analysis/tie-rules.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

function fallNow(c: number[]) { const t = Math.max(...c); return c.flatMap((v, i) => (v === t ? [i] : [])); }
function fallNew(c: number[]) { const uniq = c.filter((v, _, a) => a.filter((x) => x === v).length === 1); if (!uniq.length) return []; const t = Math.max(...uniq); return [c.indexOf(t)]; }
for (const n of [4, 6, 8]) {
  let T = 0, tieNow = 0, same = 0, none = 0, diff = 0, topSaved = 0, multiNow = 0; const gap: number[] = [];
  for (let g = 0; g < 40; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 9000 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 19 + 7; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0;
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") {
        const res = s.lastResult!, c = Array.from({ length: n }, (_, i) => res.counts[i + 1] ?? 0); T++;
        const a = fallNow(c), b = fallNew(c); if (a.length > 1) { tieNow++; multiNow++; }
        if (!b.length) none++; else if (a.length === 1 && a[0] === b[0]) same++; else { diff++; if (a.length > 1 || a[0] !== b[0]) topSaved++; gap.push(Math.max(...c) - c[b[0]!]!); }
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  const pc = (x: number) => (100 * x / T).toFixed(0) + "%";
  console.log(`${n} giocatori · ${T} turni: pareggio in testa oggi ${pc(tieNow)} · con la regola nuova: cade la stessa carta ${pc(same)} · NON cade nessuno ${pc(none)} · cade un'altra carta (una carta non in testa) ${pc(diff)}${gap.length ? ` (di media ${(gap.reduce((a, b) => a + b, 0) / gap.length).toFixed(1)} voti sotto la più votata)` : ""}`);
}
