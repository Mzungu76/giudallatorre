import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyAction, createGame, isLegal, legalActions, learnFromResult, newBotMemory, observe } from "@gdt/game-engine";
import type { GameState } from "@gdt/game-engine";
import { nextRandom } from "../../game-engine/src/rng.ts";
import { STRATEGIC_ENGINES, randomLegal } from "../src/index.ts";

const SRC = new URL("../src", import.meta.url).pathname;
const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith(".ts") ? [join(d, f)] : []));
/** Cosa il codice del motore può importare da @gdt/game-engine: solo tipi e utilità che non danno accesso allo stato nascosto. */
const ALLOWED = new Set(["Action", "BotLevel", "BotStyle", "Observation", "PlayerId", "CardId", "TurnRecord", "TurnResult", "LuiSlot", "PhraseChoice", "PlayerView", "legalActions", "isLegal", "scoreTurn", "tallyMarks", "affinity", "phraseTagCount", "inferTags", "nextRandom", "shuffle", "cncPool", "luiTokens", "roundsFor", "MIN_PLAYERS", "MAX_PLAYERS", "MINI_CARDS", "MINI_CYCLES"]);

describe("confine tra motore strategico e stato di gioco", () => {
  it("src/ importa da @gdt/game-engine solo nomi della lista consentita (niente GameState, applyAction, createGame, viewFor, observe, …)", () => {
    const bad: string[] = [];
    for (const f of files(SRC)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@gdt\/game-engine"/g))
        for (const name of m[1]!.split(",").map((x) => x.replace(/^\s*type\s+/, "").trim().split(/\s+as\s+/)[0]!).filter(Boolean)) if (!ALLOWED.has(name)) bad.push(`${f.replace(SRC, "src")}: ${name}`);
      if (/\.\.\/\.\.\/game-engine|packages\/game-engine/.test(src)) bad.push(`${f.replace(SRC, "src")}: percorso diretto a game-engine`);
      if (/\bGameState\b/.test(src)) bad.push(`${f.replace(SRC, "src")}: GameState`);
    }
    expect(bad).toEqual([]);
  });
});

describe("agente di riferimento casuale (solo osservazione)", () => {
  it("è registrato e gioca partite intere sempre con azioni legali", () => {
    expect(STRATEGIC_ENGINES[randomLegal.id]).toBeDefined();
    for (const n of [3, 5, 8]) for (let seed = 1; seed <= 3; seed++) {
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `B${i + 1}` }));
      let s: GameState = createGame({ players, seed, deck: Array.from({ length: 125 }, (_, i) => `c${i}`), phraseDeck: [{ id: "x", phrases: ["a", "b", "c", "d", "e"] }, { id: "y", phrases: ["f", "g", "h", "i", "j"] }], miniGame: "random" }).state;
      const mem = randomLegal.newMemory(), bm = newBotMemory(); let r = seed + n, g = 0;
      const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
      while (s.phase !== "GAME_OVER" && g++ < 6000) {
        let moved = false;
        for (const p of s.playerIds) {
          const o = observe(s, p), a = randomLegal.decide(mem, o, { rand, level: "easy", style: { id: "n", conf: .5, herd: .5, bluff: .5, susp: .5, risk: .5, speed: .5 } });
          if (a) { expect(isLegal(o, a)).toBe(true); s = applyAction(s, a).state; moved = true; break; } else expect(legalActions(o).length).toBe(0);
        }
        if (moved) continue;
        const before = s.phase, tower = s.tower; s = applyAction(s, s.phase === "MINI_RUN" ? { type: "endRun" } : { type: "advance" }).state;
        if (before === "RESULTS" && s.lastResult) { learnFromResult(bm, tower, s.lastResult); randomLegal.learn(mem, observe(s, "p1")); }
      }
      expect(s.phase).toBe("GAME_OVER");
    }
  });
});
