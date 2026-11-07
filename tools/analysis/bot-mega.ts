// Punti medi per turno quando il bot è il Megafono, per livello (tavolo misto, mazzo e etichette reali).
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import type { BotLevel } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";
const tot: Record<string, { pts: number; n: number; cade: number; hit: number }> = {};
for (const n of [4, 6]) for (let g = 0; g < 150; g++) {
  const base: BotLevel[] = n === 4 ? ["easy", "medium", "hard", "hard"] : ["easy", "easy", "medium", "medium", "hard", "hard"]; const levels = base.slice().sort(() => ((g * 7 + 3) % 5) - 2.3);
  let s = createGame({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed: 900 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
  const mem = newBotMemory(); let r = g + 11; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let guard = 0;
  while (s.phase !== "GAME_OVER" && guard++ < 6000) {
    if (s.phase === "RESULTS") { const res = s.lastResult!, mi = s.playerIds.indexOf(res.megafonoId), lv = levels[mi]!; const t = (tot[lv] ??= { pts: 0, n: 0, cade: 0, hit: 0 });
      t.pts += res.points[res.megafonoId]!; t.n++; if (res.lui?.kind === "CADE") { t.cade++; if (res.lui.position === res.fallenPosition) t.hit++; }
      learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
    for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, levels[i]!, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
  }
}
for (const lv of ["easy", "medium", "hard"]) { const t = tot[lv]!; console.log(`${lv.padEnd(7)} Megafono: ${(t.pts / t.n).toFixed(2)} punti a turno · "Cade lui!" nel ${(100 * t.cade / t.n).toFixed(0)}% dei turni, azzeccato ${(100 * t.hit / Math.max(1, t.cade)).toFixed(0)}%`); }
