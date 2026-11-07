// Pareggio deciso dal Megafono: quanto spesso il suo voto è tra le carte pari merito, e cosa cambia per lui e per gli altri. Uso: npx tsx tools/analysis/tie-mega.ts
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { DECK, PHRASE_DECK } from "../../worker/src/content.ts";

for (const n of [4, 6, 8]) {
  let T = 0, ties = 0, megaIn = 0, tiedSum = 0, nowMega = 0, r1Mega = 0, r2Mega = 0, nowOthers = 0, r2Others = 0, r1Others = 0;
  for (let g = 0; g < 40; g++) {
    let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "P" + i })), seed: 9500 + g, deck: DECK, phraseDeck: PHRASE_DECK, mixPhrases: true }).state;
    const mem = newBotMemory(); let r = g * 23 + 9; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let k = 0;
    while (s.phase !== "GAME_OVER" && k++ < 6000) {
      if (s.phase === "RESULTS") {
        const res = s.lastResult!, m = res.megafonoId, mv = res.votes[m]!, c = Array.from({ length: n }, (_, i) => res.counts[i + 1] ?? 0), top = Math.max(...c), tied = c.flatMap((v, i) => (v === top ? [i + 1] : []));
        T++; const voters = Object.entries(res.votes).filter(([id]) => id !== m);
        const pts = (fallen: number[]) => ({ mega: fallen.includes(mv) ? 2 : 0, others: voters.filter(([, v]) => fallen.includes(v)).length * 2 + fallen.length * 2 });
        const now = pts(tied); nowMega += now.mega; nowOthers += now.others;
        if (tied.length > 1) { ties++; tiedSum += tied.length; if (tied.includes(mv)) megaIn++;
          const a = pts(tied.includes(mv) ? [mv] : tied); r2Mega += a.mega; r2Others += a.others;   // R2: il Megafono sceglie tra le pari merito se c'è il suo voto
          const b = pts([mv]); r1Mega += b.mega; r1Others += b.others;                              // R1 (originale): cade sempre la carta votata dal Megafono
        } else { r2Mega += now.mega; r2Others += now.others; r1Mega += now.mega; r1Others += now.others; }
        learnFromResult(mem, s.tower, res); s = applyAction(s, { type: "advance" }).state; continue; }
      for (let i = 0; i < n; i++) { const a = chooseBotAction(s, s.playerIds[i]!, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
    }
  }
  const f = (x: number) => (x / T).toFixed(2);
  console.log(`${n} giocatori · ${T} turni · pareggi ${(100 * ties / T).toFixed(0)}% (carte pari in media ${(tiedSum / Math.max(1, ties)).toFixed(1)}) · il Megafono ha votato una delle carte pari nel ${(100 * megaIn / Math.max(1, ties)).toFixed(0)}% dei pareggi\n   punti per turno [Megafono / somma degli altri] — oggi ${f(nowMega)} / ${f(nowOthers)} · R2 (il Megafono sceglie tra le pari) ${f(r2Mega)} / ${f(r2Others)} · R1 (cade sempre la sua carta) ${f(r1Mega)} / ${f(r1Others)}`);
}
