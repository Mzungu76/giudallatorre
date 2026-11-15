import { describe, expect, it } from "vitest";
import { applyAction, createGame, getBotEngine } from "../src/index.ts";
import type { BotLevel, GameState } from "../src/index.ts";
import { nextRandom } from "../src/rng.ts";
import { cfg } from "./helpers.ts";

/** Gioca partite intere con un motore e restituisce l'elenco delle azioni e i punteggi. */
function run(id: string, seed: number, n: number): string {
  const eng = getBotEngine(id); let s: GameState = createGame(cfg(n, { seed })).state; const mem = eng.newMemory(), log: string[] = []; let r = seed * 31, g = 0;
  const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
  while (s.phase !== "GAME_OVER" && g++ < 4000) {
    if (s.phase === "RESULTS") { eng.learn(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
    const a = s.playerIds.map((p, i) => eng.chooseAction(s, p, (["easy", "medium", "hard"] as BotLevel[])[(i + seed) % 3]!, mem, rand)).find((x) => x);
    if (!a) throw new Error("bloccata"); log.push(JSON.stringify(a)); s = applyAction(s, a).state;
  }
  return log.join("|") + JSON.stringify(s.scores);
}

describe("bot v2: con le leve spente decide come i bot attuali", () => {
  it("partite intere identiche (3–6 giocatori, tutti i livelli)", () => {
    const t = getBotEngine("v2").tune, saved = { ...t };
    try { t.markBoost = 0; t.adaptFollow = 0; for (const n of [3, 4, 5, 6]) for (let seed = 1; seed <= 5; seed++) expect(run("v2", seed, n), `n ${n} seed ${seed}`).toBe(run("production", seed, n)); } finally { Object.assign(t, saved); }
  });
  it("con le leve accese (predefinito) gioca partite complete legali", () => {
    const t = getBotEngine("v2").tune, saved = { ...t };
    try { for (const n of [3, 5]) expect(run("v2", 3, n).length).toBeGreaterThan(50); } finally { Object.assign(t, saved); }
  });
});
