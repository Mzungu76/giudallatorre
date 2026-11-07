// Confronto tra livelli dei giocatori virtuali con il mazzo e le etichette reali. Uso: npx tsx tools/analysis/bot-bench.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import type { BotLevel, GameState } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts"; // registra anche le etichette

function play(levels: BotLevel[], seed: number): GameState {
  const n = levels.length;
  let s = createGame({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
  const mem = newBotMemory(); let r = seed | 0; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let g = 0;
  while (s.phase !== "GAME_OVER" && g++ < 6000) {
    if (s.phase === "RESULTS") { learnFromResult(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
    for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, levels[i]!, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
  }
  return s;
}
function bench(name: string, focus: BotLevel, others: BotLevel, n: number, games = 300) {
  let wins = 0, pts = 0, opp = 0, megaPts = 0, megaTurns = 0;
  for (let g = 0; g < games; g++) {
    const lv: BotLevel[] = [focus, ...Array(n - 1).fill(others)]; const slot = g % n; [lv[0], lv[slot]] = [lv[slot]!, lv[0]!];
    const s = play(lv, 1000 + g), me = "p" + slot, sc = s.scores;
    if (s.winners?.includes(me)) wins++; pts += sc[me]!; opp += Object.entries(sc).filter(([k]) => k !== me).reduce((a, [, v]) => a + v, 0) / (n - 1);
  }
  console.log(`${name} (${n} giocatori): vittorie ${(100 * wins / games).toFixed(0)}% (caso ${(100 / n).toFixed(0)}%) · punti ${(pts / games).toFixed(1)} contro ${(opp / games).toFixed(1)}`);
}
for (const n of [4, 6]) { bench("difficile vs 3 facili", "hard", "easy", n); bench("difficile vs medi", "hard", "medium", n); bench("medio vs facili", "medium", "easy", n); bench("difficile vs difficili", "hard", "hard", n, 100); }
