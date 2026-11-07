// Dove votano i bot: quota di voti sulla carta col Lui!, sulla più "affine", e quanto spesso tutti votano la stessa carta. Uso: npx tsx tools/analysis/bot-votes.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory, megafonoOf } from "../../packages/game-engine/src/index.ts";
import type { BotLevel } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

function run(levels: BotLevel[], games: number) {
  const n = levels.length; let votes = 0, onLui = 0, unanimous = 0, turns = 0, megaOnLui = 0, megaVotes = 0, fallLui = 0, topShare = 0, luiCade = 0;
  for (let g = 0; g < games; g++) {
    let s = createGame({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed: 500 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 7 + 1; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0;
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") { const res = s.lastResult!; turns++;
        const lp = res.lui!.position, mega = res.megafonoId; if (res.lui!.kind === "CADE") luiCade++;
        const vs = Object.entries(res.votes); const others = vs.filter(([p]) => p !== mega);
        for (const [p, pos] of vs) { if (p === mega) { megaVotes++; if (pos === lp) megaOnLui++; } else { votes++; if (pos === lp) onLui++; } }
        if (new Set(others.map(([, v]) => v)).size === 1) unanimous++;
        topShare += Math.max(...Object.values(res.counts)) / n; if (res.fallenPositions.includes(lp)) fallLui++;
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, levels[i]!, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  const pc = (a: number, b: number) => (100 * a / b).toFixed(0) + "%";
  console.log(`${levels.join("/")}: turni ${turns} · voti della Folla sulla carta col Lui! ${pc(onLui, votes)} (caso ${(100 / 5).toFixed(0)}%) · Megafono vota il Lui! ${pc(megaOnLui, megaVotes)} · tutti gli altri uguali ${pc(unanimous, turns)} · cade la carta col Lui! ${pc(fallLui, turns)} · "Cade lui" ${pc(luiCade, turns)} · voti sul più votato ${pc(topShare, turns)}`);
}
for (const lv of [["hard", "hard", "hard", "hard", "hard"], ["medium", "medium", "medium", "medium", "medium"], ["easy", "easy", "easy", "easy", "easy"]] as BotLevel[][]) run(lv, 60);
