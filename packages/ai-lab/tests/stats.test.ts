import { describe, expect, it } from "vitest";
import { gamesNeeded, hashString, meanCI, pairedDiff, wilson } from "../src/index.ts";

describe("statistica del laboratorio", () => {
  it("meanCI: media, deviazione e intervallo al 95% su un caso calcolato a mano", () => {
    const r = meanCI([2, 4, 4, 4, 5, 5, 7, 9]);   // media 5, sd campionaria = sqrt(32/7)
    expect(r.mean).toBe(5); expect(r.sd).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(r.half).toBeCloseTo(1.959964 * Math.sqrt(32 / 7) / Math.sqrt(8), 10);
    expect(r.lo).toBeCloseTo(5 - r.half, 10);
  });
  it("meanCI su un solo dato o su nessuno non esplode", () => {
    expect(meanCI([3])).toMatchObject({ n: 1, mean: 3, sd: 0, half: 0 });
    expect(Number.isNaN(meanCI([]).mean)).toBe(true);
  });
  it("wilson: 50/100 ≈ [0.404, 0.596]; 0/20 resta sopra lo zero; 20/20 sotto l'uno", () => {
    const w = wilson(50, 100); expect(w.lo).toBeCloseTo(0.4038, 3); expect(w.hi).toBeCloseTo(0.5962, 3);
    expect(wilson(0, 20).lo).toBeGreaterThanOrEqual(0); expect(wilson(0, 20).hi).toBeGreaterThan(0);
    expect(wilson(20, 20).hi).toBeLessThanOrEqual(1); expect(wilson(20, 20).lo).toBeLessThan(1);
  });
  it("pairedDiff: rileva una differenza costante e non ne inventa una dove non c'è", () => {
    const a = Array.from({ length: 200 }, (_, i) => 10 + Math.sin(i)), b = a.map((x) => x - 1.5);
    const d = pairedDiff(a, b); expect(d.mean).toBeCloseTo(1.5, 10); expect(d.significant).toBe(true);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const x = Array.from({ length: 400 }, () => rnd() * 10), y = Array.from({ length: 400 }, () => rnd() * 10);
    expect(pairedDiff(x, y).half).toBeGreaterThan(Math.abs(pairedDiff(x, y).mean) / 3);   // intervallo largo quanto l'effetto: nessuna certezza
  });
  it("falsi positivi: su coppie dello stesso processo l'IC al 95% contiene lo zero circa il 95% delle volte", () => {
    let s = 12345; const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; }; let miss = 0; const T = 400;
    for (let t = 0; t < T; t++) { const a = Array.from({ length: 60 }, rnd), b = Array.from({ length: 60 }, rnd); if (pairedDiff(a, b).significant) miss++; }
    expect(miss / T).toBeLessThan(0.09); expect(miss / T).toBeGreaterThan(0.02);
  });
  it("gamesNeeded cresce col quadrato di sd/delta", () => {
    expect(gamesNeeded(8, 1)).toBeGreaterThan(gamesNeeded(8, 2) * 3.5);
    expect(gamesNeeded(8, 0.5)).toBeGreaterThan(400);
  });
  it("hashString è deterministico e sensibile ai cambi", () => {
    expect(hashString("abc")).toBe(hashString("abc")); expect(hashString("abc")).not.toBe(hashString("abd"));
  });
});
