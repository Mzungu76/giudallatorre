// Variante «Il gregge»: quanto sono prevedibili i bot con i segnalini Lui!, divisi per soglia della partita.
// Per ogni soglia: quante volte il Megafono sceglie l'Imbroglio! o la soglia, quanti degli altri votano la carta del Lui!
// (con ciascun gettone, e quanto la voterebbero senza segnalino), quanto spesso riesce, punti del Megafono e degli altri nel turno.
// Uso: npx tsx tools/analysis/gregge-bots.ts [hard|medium] [partite per numero di giocatori]
import { applyAction, chooseBotAction, createGame, learnFromResult, luiTokens, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { crowdProbs } from "../../packages/game-engine/src/ai.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

const level = (process.argv[2] ?? "hard") as "hard" | "medium", GAMES = Number(process.argv[3] ?? 80);
type Acc = { t: number; hit: number; mega: number; others: number; onX: number; voters: number; base: number; top: number; spread: number[] };
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—").padStart(4);
for (const n of [3, 4, 5, 6, 8]) {
  const by: Record<string, { imb: Acc; soglia: Acc }> = {};
  const acc = (): Acc => ({ t: 0, hit: 0, mega: 0, others: 0, onX: 0, voters: 0, base: 0, top: 0, spread: [] });
  for (let g = 0; g < GAMES; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 4200 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true, gregge: true }).state;
    const set = luiTokens(s).find((x) => !x.trap)!, key = `soglia ${set.k}+ (+${set.pts})`, B = (by[key] ??= { imb: acc(), soglia: acc() });
    const mem = newBotMemory(); let r = g * 37 + 11, base = 0, topCard = false; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
    for (let k = 0; k < 6000 && s.phase !== "GAME_OVER"; k++) {
      if (s.phase === "RESULTS") {
        const res = s.lastResult!, lui = res.lui!, m = res.megafonoId, e = lui.trap ? B.imb : B.soglia;
        e.t++; if (lui.hit) e.hit++; e.mega += res.points[m]!;
        e.others += Object.entries(res.points).filter(([id]) => id !== m).reduce((a, [, v]) => a + v, 0) / (n - 1);
        e.onX += lui.others; e.voters += n - 1; e.base += base * (n - 1); if (topCard) e.top++;
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue;
      }
      if (s.phase.startsWith("MINI")) break;
      if (s.phase === "VOTE" && Object.keys(s.votes).length === 0) { const p = crowdProbs(s, mem, "hard"); base = p[s.lui!.position - 1]!; topCard = base === Math.max(...p); }
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, level, mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  console.log(`== ${n} giocatori (${level})`);
  for (const [k, { imb, soglia }] of Object.entries(by).sort()) {
    const T = imb.t + soglia.t;
    console.log(`  partite con ${k.padEnd(16)} Megafono sceglie: Imbroglio ${pct(imb.t, T)} · soglia ${pct(soglia.t, T)}`);
    for (const [nm, e] of [["Imbroglio", imb], ["soglia   ", soglia]] as const) if (e.t)
      console.log(`     ${nm}: sulla carta più votata ${pct(e.top, e.t)} · gli altri la votano ${pct(e.onX, e.voters)} (senza segnalino ~${pct(e.base, e.voters).trim()}) · riesce ${pct(e.hit, e.t)} · Megafono ${(e.mega / e.t).toFixed(1)} · altri ${(e.others / e.t).toFixed(1)}`);
  }
}
