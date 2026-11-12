// Variante PROPAGANDA: quanto si usano e quanto cambiano l'esito i 6 segnalini, e come vanno gli obiettivi contrapposti (bot).
// Uso: npx tsx tools/analysis/propaganda.ts [hard|medium] [partite per numero di giocatori] [obiettivi: 0|1]
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

const level = (process.argv[2] ?? "hard") as "hard" | "medium", GAMES = Number(process.argv[3] ?? 40), objectives = process.argv[4] !== "0";
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—").padStart(4);
for (const n of [3, 4, 5, 6, 8]) {
  const eff: Record<string, { t: number; hit: number; megaFell: number }> = {}, obj: Record<string, { t: number; hit: number; mega: number; folla: number; winners: number }> = {};
  let turns = 0, megaPts = 0, othersPts = 0;
  for (let g = 0; g < GAMES; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 7700 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true, propaganda: true, objectives }).state;
    const mem = newBotMemory(); let r = g * 41 + 9; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    for (let k = 0; k < 8000 && s.phase !== "GAME_OVER"; k++) {
      if (s.phase === "RESULTS") {
        const res = s.lastResult!, m = res.megafonoId, lui = res.lui!, e = (eff[lui.effect!] ??= { t: 0, hit: 0, megaFell: 0 });
        e.t++; if (lui.hit) e.hit++; if (res.fallenPositions.includes(res.megaVote)) e.megaFell++;
        turns++; megaPts += res.points[m]!; othersPts += Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        if (res.objective) { const o = res.objective, key = `${o.kind} ${o.k} (+${o.pts})`, q = (obj[key] ??= { t: 0, hit: 0, mega: 0, folla: 0, winners: 0 }); q.t++; if (o.megaHit) q.hit++; q.winners += o.winners.length; }
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue;
      }
      if (s.phase.startsWith("MINI")) break;
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, level, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  console.log(`== ${n} giocatori (${level}${objectives ? ", con obiettivi" : ""}) · punti a turno: Megafono ${(megaPts / turns).toFixed(1)}, altri ${(othersPts / turns).toFixed(1)}`);
  for (const [k, e] of Object.entries(eff).sort()) console.log(`  ${k.padEnd(13)} usato ${pct(e.t, turns)} dei turni · ha effetto ${pct(e.hit, e.t)} · cade la carta votata dal Megafono ${pct(e.megaFell, e.t)}`);
  for (const [k, q] of Object.entries(obj).sort()) console.log(`  obiettivo ${k.padEnd(16)} riesce al Megafono ${pct(q.hit, q.t)} · se fallisce, giocatori della Folla premiati in media ${(q.winners / Math.max(1, q.t - q.hit)).toFixed(1)}`);
}
