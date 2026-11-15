// Confronto testa a testa tra due versioni dei bot (registro BOT_ENGINES) con mazzi ed etichette reali.
// Uso: GAMES=1000 PLAYERS=4 LEVEL=hard A=baseline-1 B=production npx tsx tools/analysis/engine-compare.ts
// Metà dei posti gioca con A, metà con B; i posti ruotano a ogni partita. Stampa vittorie (parità divise), punti medi e intervalli di confidenza al 95%
// calcolati sulla differenza per partita (stesso tavolo, stesso seme). È il precursore dell'AI Laboratory (docs/AI_BENCHMARKS.md).
import { applyAction, buildPhraseDeck, createGame, DEFAULT_AGE_BAND, getBotEngine } from "../../packages/game-engine/src/index.ts";
import type { BotLevel, GameState } from "../../packages/game-engine/src/index.ts";
import { nextRandom } from "../../packages/game-engine/src/rng.ts";
import { ACCUSE_DECK, CONFESSIONS, DECK, PHRASE_POOL } from "../../worker/src/content.ts"; // registra anche le etichette

const GAMES = Number(process.env.GAMES ?? 200), N = Number(process.env.PLAYERS ?? 4), LEVEL = (process.env.LEVEL ?? "hard") as BotLevel;
const A = getBotEngine(process.env.A ?? "baseline-1"), B = getBotEngine(process.env.B ?? "production");
// Parametri di taratura per versione: TUNE_A_noncadeEv=1 oppure TUNE_B_noncadeEv=0.75 (sovrascrivono TUNE di quella versione, solo in questo processo)
for (const [k, v] of Object.entries(process.env)) { const m = /^TUNE_([AB])_(.+)$/.exec(k); if (m) (m[1] === "A" ? A : B).tune[m[2]!] = Number(v); }
const tuneNote = [A, B].map((e, i) => `${i ? "B" : "A"}:${Object.entries(e.tune).filter(([k]) => process.env[`TUNE_${i ? "B" : "A"}_${k}`] !== undefined).map(([k, v]) => `${k}=${v}`).join(",") || "predefiniti"}`).join(" ");

function play(seats: ("A" | "B")[], seed: number): { scores: number[]; ms: number } {
  const eng = (i: number) => (seats[i] === "A" ? A : B), t0 = performance.now();
  const players = seats.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
  let s: GameState = createGame({ players, seed, deck: DECK, phraseDeck: buildPhraseDeck(PHRASE_POOL!, CONFESSIONS, { age: DEFAULT_AGE_BAND, seed: seed ^ 0x5bd1e995, confessions: true }), miniGame: "random", accuseDeck: ACCUSE_DECK }).state;
  const mem = { A: A.newMemory(), B: B.newMemory() }; let r = seed | 0, g = 0; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
  while (s.phase !== "GAME_OVER" && g++ < 8000) {
    if (s.phase === "RESULTS" || s.phase === "MINI_RESULTS") { if (s.phase === "RESULTS" && s.lastResult) { A.learn(mem.A, s.tower, s.lastResult); B.learn(mem.B, s.tower, s.lastResult); } s = applyAction(s, { type: "advance" }).state; continue; }
    let acted = false;
    for (let i = 0; i < N; i++) { const a = eng(i).chooseAction(s, `p${i}`, LEVEL, mem[seats[i]!], rand); if (a) { s = applyAction(s, a).state; acted = true; break; } }
    if (!acted) { if (s.phase === "MINI_RUN") { s = applyAction(s, { type: "endRun" }).state; continue; } throw new Error("bloccata in " + s.phase); }
  }
  return { scores: s.playerIds.map((p) => s.scores[p]!), ms: performance.now() - t0 };
}

const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const ci = (x: number[]) => { const m = mean(x), sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, x.length - 1)); return [m, 1.96 * sd / Math.sqrt(x.length)] as const; };
const dScore: number[] = [], dWin: number[] = [], sa: number[] = [], sb: number[] = []; let ms = 0;
for (let k = 0; k < GAMES; k++) {
  const seats = Array.from({ length: N }, (_, i) => ((i + k) % 2 === 0 ? "A" : "B")) as ("A" | "B")[];
  const { scores, ms: t } = play(seats, 1000 + k); ms += t;
  const top = Math.max(...scores), winners = scores.filter((x) => x === top).length, share = { A: 0, B: 0 }, tot = { A: 0, B: 0 }, cnt = { A: 0, B: 0 };
  scores.forEach((x, i) => { tot[seats[i]!] += x; cnt[seats[i]!]++; if (x === top) share[seats[i]!] += 1 / winners; });
  const mA = tot.A / cnt.A, mB = tot.B / cnt.B; sa.push(mA); sb.push(mB); dScore.push(mA - mB); dWin.push(share.A / cnt.A - share.B / cnt.B);
}
const [ds, dsE] = ci(dScore), [dw, dwE] = ci(dWin);
console.log(`${A.id} (A) contro ${B.id} (B) [${tuneNote}] · livello ${LEVEL} · ${N} giocatori · ${GAMES} partite (${(ms / GAMES).toFixed(0)} ms/partita)`);
console.log(`punti medi per posto: A ${mean(sa).toFixed(2)} · B ${mean(sb).toFixed(2)} · differenza A−B ${ds.toFixed(2)} ± ${dsE.toFixed(2)} (IC 95%)`);
console.log(`quota vittorie per posto: differenza A−B ${(100 * dw).toFixed(1)} ± ${(100 * dwE).toFixed(1)} punti percentuali (IC 95%; 0 = pari)`);
console.log(Math.abs(ds) > dsE ? `→ differenza nei punti statisticamente rilevabile (${ds > 0 ? "A" : "B"} meglio)` : "→ nessuna differenza rilevabile con questo campione");
