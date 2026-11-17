import { describe, expect, it } from "vitest";
import { drawLens, imagineOther, LENS_KEYS, lensFor, mulberry, posBias, tasteLogits } from "../src/ai-v2/lens.ts";
import { BOT_ENGINES, createGame, applyAction, suggestAction } from "../src/index.ts";
import { checkInvariants } from "../src/invariants.ts";
import { makeDeck, names, PHRASES } from "./helpers.ts";

describe("lenti dei bot (v2o)", () => {
  it("la lente è stabile per bot e stanza, diversa tra bot, con valori nei limiti", () => {
    const ids = ["a", "b", "c", "d"], l1 = lensFor("a", ids), l2 = lensFor("a", ids);
    expect(l1).toEqual(l2); expect(lensFor("b", ids)).not.toEqual(l1); expect(lensFor("a", ["a", "b", "c", "e"])).not.toEqual(l1);
    for (let i = 0; i < 200; i++) { const l = drawLens(mulberry(i)); for (const k of LENS_KEYS) { expect(l[k]).toBeGreaterThanOrEqual(k === "rho" ? -0.4 : 0); expect(l[k]).toBeLessThanOrEqual(1.6); } }
  });
  it("falso consenso: con proj alto gli altri immaginati somigliano a me, con proj 0 sono la media della popolazione", () => {
    const own = { ...drawLens(mulberry(5)), own: 1.1, proj: 0.5 }, r = mulberry(9);
    const mean = (f: (l: ReturnType<typeof drawLens>) => number, proj: number) => { let s = 0; for (let i = 0; i < 400; i++) s += f(imagineOther(r, { ...own, proj })); return s / 400; };
    expect(Math.abs(mean((l) => l.own, 0.5) - 1.1)).toBeLessThan(Math.abs(mean((l) => l.own, 0) - 1.1));
  });
  it("preferenza per la propria carta e gli altri gusti: spostano il punteggio nella direzione giusta", () => {
    const l = { ...drawLens(mulberry(1)), own: 0.8, sal: 0.4, fun: 0, rho: -0.3, posKind: "first" as const, posG: 0.2 };
    const t = tasteLogits(l, 4, [0.2, 0.9, 0.5, 0.5], [0, 0, 0, 0], [false, false, true, false], 3);
    expect(t[2]! - t[3]!).toBeCloseTo(0.8 - 0.3 - 0, 5);                                   // propria carta (+0,8) ma «non può ricadere» (−0,3): la 3 vs la 4 senza altri gusti
    expect(t[1]!).toBeGreaterThan(t[3]!);                                                  // la carta più appariscente attira più delle altre
    expect(posBias(l, 1, 4)).toBe(0.2); expect(posBias(l, 2, 4)).toBe(0);
  });
  it("v2o: partite complete legali da 3 a 6 giocatori, con memoria serializzabile", () => {
    const e = BOT_ENGINES["v2o"]!;
    for (const n of [3, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`), mem = e.newMemory();
      let s = createGame({ players: names(n), seed: 31 + n, deck: makeDeck(125), phraseDeck: PHRASES, firstMegafonoIndex: 0 }).state, r = 7 + n, g = 0;
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      while (s.phase !== "GAME_OVER" && g++ < 3000) {
        if (s.phase === "RESULTS") { e.learn(mem, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
        let acted = false;
        for (const p of ids) { const a = e.chooseAction(s, p, "hard", mem, rand) ?? suggestAction(s, p, rand); if (a) { s = applyAction(s, a).state; acted = true; break; } }
        if (!acted) break;
      }
      expect(s.phase).toBe("GAME_OVER"); expect(checkInvariants(s, makeDeck(125))).toEqual([]); expect(JSON.parse(JSON.stringify(mem))).toEqual(mem);
    }
  });
});
