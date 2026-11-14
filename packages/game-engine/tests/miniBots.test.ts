import { describe, expect, it } from "vitest";
import { MINI_SLOT_MS, newBotMemory, planMiniVote, suggestAction } from "../src/index.ts";
import type { BotLevel, GameState, MiniKind } from "../src/index.ts";
import { act, start } from "./helpers.ts";

function toMini(kind: MiniKind, n = 4): GameState {
  let s = start(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"] }), g = 0, r = 7;
  const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (s.phase !== "MINI_RUN" && g++ < 3000) {
    if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
    for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
  }
  return s;
}
const rng = (seed: number) => { let r = seed; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

describe("fuori programma: i bot votano come persone", () => {
  const s = toMini("accusa"), me = s.playerIds[1]!;
  it("il tempo di reazione è umano (0,65–2,75 s) e la carta votata è quella in scena in quell'uscita", () => {
    for (const lvl of ["easy", "medium", "hard"] as BotLevel[]) for (let k = 1; k <= 60; k++) {
      const p = planMiniVote(s, me, lvl, newBotMemory(), rng(k)); if (!p) continue;
      expect(p.delayMs).toBeGreaterThanOrEqual(650); expect(p.delayMs).toBeLessThanOrEqual(2750);
      expect(p.slot * MINI_SLOT_MS + p.delayMs).toBeLessThan(s.mini!.order.length * MINI_SLOT_MS);
      expect(s.mini!.order[p.slot]).toBe(p.position);
    }
  });
  it("non votano tutti al primo giro e non sempre per primi: molti aspettano di aver visto le carte", () => {
    let first = 0, later = 0, none = 0;
    for (let k = 1; k <= 300; k++) { const p = planMiniVote(s, me, "medium", newBotMemory(), rng(k)); if (!p) none++; else if (p.slot < 6) first++; else later++; }
    expect(later).toBeGreaterThan(first * 0.5); expect(first + later).toBeGreaterThan(200);
  });
  it("la decisione non dipende da informazioni nascoste: mani, voti e altro non cambiano il piano", () => {
    const t = structuredClone(s) as GameState;
    for (const p of t.playerIds) { (t.hands as Record<string, string[]>)[p] = []; }
    for (let k = 1; k <= 40; k++) expect(planMiniVote(t, me, "hard", newBotMemory(), rng(k))).toEqual(planMiniVote(s, me, "hard", newBotMemory(), rng(k)));
  });
});
