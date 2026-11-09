// Variante «Il gregge»: quanto rendono al Megafono l'Imbroglio! e le soglie, e quanto spesso gli altri bot votano la carta del Lui!
// (rispetto alla probabilità che la voterebbero senza segnalino). Uso: npx tsx tools/analysis/imbroglio.ts [livello: hard|medium]
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

const level = (process.argv[2] ?? "hard") as "hard" | "medium", GAMES = Number(process.argv[3] ?? 150);
for (const n of [3, 4, 5, 6, 8]) {
  const st: Record<string, { t: number; hit: number; mega: number; others: number; onX: number; voters: number; base: number }> = {};
  for (let g = 0; g < GAMES; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 900 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true, gregge: true }).state;
    const mem = newBotMemory(); let r = g * 31 + 5, base = 0; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    for (let k = 0; k < 6000 && s.phase !== "GAME_OVER"; k++) {
      if (s.phase === "RESULTS") {
        const res = s.lastResult!, lui = res.lui!, m = res.megafonoId, key = lui.trap ? `Imbroglio (${lui.pts}pt)` : `soglia ${lui.k}+ (${lui.pts}pt)`;
        const e = (st[key] ??= { t: 0, hit: 0, mega: 0, others: 0, onX: 0, voters: 0, base: 0 });
        e.t++; if (lui.hit) e.hit++; e.mega += res.points[m]!;
        e.others += Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        e.onX += lui.others; e.voters += n - 1; e.base += base * (n - 1);
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue;
      }
      if (s.phase.startsWith("MINI")) break;
      if (s.phase === "VOTE" && Object.keys(s.votes).length === 0) base = crowdProbs(s, mem, "hard")[s.lui!.position - 1]!;
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, level, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  console.log(`== ${n} giocatori (${level})`);
  for (const [k, e] of Object.entries(st).sort()) console.log(`  ${k.padEnd(20)} turni ${String(e.t).padStart(4)}  riesce ${(100 * e.hit / e.t).toFixed(0).padStart(3)}%  Megafono ${(e.mega / e.t).toFixed(2)}  altri ${(e.others / e.t).toFixed(2)}  votano la carta del Lui! ${(100 * e.onX / e.voters).toFixed(0).padStart(3)}% (senza segnalino ~${(100 * e.base / e.voters).toFixed(0)}%)`);
}
