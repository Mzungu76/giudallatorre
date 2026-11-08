// Statistiche di gioco con giocatori virtuali (voto casuale e voto "di gregge"). Uso: npx tsx tools/analysis/simulate-stats.ts
import { applyAction, createGame, megafonoOf, requiredPlayers } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { readFileSync } from "node:fs";
const man = JSON.parse(readFileSync("public/cards/manifest.json", "utf8")) as { id: string }[];
const multi = JSON.parse(readFileSync("content/storico/su-sulla-torre.json", "utf8")).carte, single = JSON.parse(readFileSync("content/storico/su-sulla-torre-singola.json", "utf8")).carte;
const deck = man.map((m) => m.id), phraseDeck = [...multi.map((c: any) => ({ id: c.id, phrases: c.frasi })), ...single.map((c: any) => ({ id: c.id, phrases: [c.frase] }))];
type Strat = "random" | "herd";
function run(n: number, seed: number, strat: Strat, sa: boolean) {
  let { state: s } = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `G${i}` })), seed, deck, phraseDeck, megafonoSa: sa, firstMegafonoIndex: 0 });
  let r = seed * 7 + 1; const rnd = () => { const x = nextRandom(r); r = x.state; return x.value; };
  const st = { turns: 0, ties: 0, deckFall: 0, luiCadeHit: 0, luiCadeN: 0, luiNonHit: 0, luiNonN: 0, megaPts: 0, folPts: 0, maxVotes: 0, noVoteForFallen: 0, taps: 0, zeroPtPlayerTurns: 0, playerTurns: 0 };
  while (s.phase !== "GAME_OVER") {
    const m = megafonoOf(s);
    if (s.phase === "PROCLAIM") { s = applyAction(s, { type: "choosePhrase", playerId: m, mode: "free" }).state; st.taps++; }
    else if (s.phase === "PLAY") { for (const p of requiredPlayers(s)) { s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![Math.floor(rnd() * 5)]! }).state; st.taps += 2; } }
    else if (s.phase === "SUSPECT") { const kind = rnd() < .5 ? "CADE" : "NON_CADE"; s = applyAction(s, { type: "placeLui", playerId: m, kind, position: 1 + Math.floor(rnd() * s.tower.length) }).state; st.taps += 3; }
    else if (s.phase === "VOTE") {
      // "gregge": 60% dei giocatori converge su 1-2 personaggi "popolari"; random: uniforme
      const pop = [1 + Math.floor(rnd() * s.tower.length), 1 + Math.floor(rnd() * s.tower.length)];
      for (const p of s.playerIds) { const pos = strat === "random" ? 1 + Math.floor(rnd() * s.tower.length) : rnd() < .6 ? pop[Math.floor(rnd() * 2)]! : 1 + Math.floor(rnd() * s.tower.length); s = applyAction(s, { type: "vote", playerId: p, position: pos }).state; st.taps += 3; }
    } else if (s.phase === "RESULTS") {
      const res = s.lastResult!; st.turns++; st.ties += res.tie ? 1 : 0; st.deckFall += res.fallenOwnerId === null ? 1 : 0;
      st.maxVotes += Math.max(...Object.values(res.counts)); if (!(res.counts[res.fallenPosition]! > 0)) st.noVoteForFallen++;
      if (res.lui) { if (res.lui.kind === "CADE") { st.luiCadeN++; st.luiCadeHit += res.lui.position === res.fallenPosition ? 1 : 0; } else { st.luiNonN++; st.luiNonHit += res.lui.position !== res.fallenPosition ? 1 : 0; } }
      for (const p of s.playerIds) { st.playerTurns++; const pt = res.points[p]!; if (p === res.megafonoId) st.megaPts += pt; else st.folPts += pt; if (pt === 0) st.zeroPtPlayerTurns++; }
      s = applyAction(s, { type: "advance" }).state; st.taps++;
    }
  }
  const sc = Object.values(s.scores).sort((a, b) => b - a);
  return { ...st, gap: sc[0]! - sc[1]!, winners: s.winners!.length, top: sc[0]!, low: sc[sc.length - 1]! };
}
for (const strat of ["random", "herd"] as Strat[]) {
  console.log(`\n== voto ${strat} ==`); console.log("giocatori | turni | pareggi% | cade carta mazzo% | Lui CADE ok% | Lui NON ok% | pt Megafono/turno | pt Folla/turno | % turni a 0 pt | distacco 1°-2° | vittorie condivise% | punti 1° | punti ultimo");
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const G = 800, a = Array.from({ length: G }, (_, i) => run(n, i + 1, strat, false)); const sum = (k: keyof typeof a[0]) => a.reduce((x, y) => x + (y[k] as number), 0);
    const T = sum("turns"), PT = sum("playerTurns");
    console.log([n, (T / G).toFixed(0), (100 * sum("ties") / T).toFixed(0), (100 * sum("deckFall") / T).toFixed(0), (100 * sum("luiCadeHit") / sum("luiCadeN")).toFixed(0), (100 * sum("luiNonHit") / sum("luiNonN")).toFixed(0),
      (sum("megaPts") / T).toFixed(2), (sum("folPts") / (PT - T)).toFixed(2), (100 * sum("zeroPtPlayerTurns") / PT).toFixed(0), (sum("gap") / G).toFixed(1), (100 * a.filter((x) => x.winners > 1).length / G).toFixed(0), (sum("top") / G).toFixed(0), (sum("low") / G).toFixed(0)].join(" | "));
  }
}
