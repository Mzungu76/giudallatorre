import { describe, expect, it } from "vitest";
import type { ScoreLine } from "@gdt/game-engine";
import { chipsFor, totals } from "../src/lib/results.ts";
import type { CardPos } from "../src/lib/results.ts";
import { buildFinale } from "../src/lib/miniScenes.ts";

const pos: Record<number, CardPos> = { 0: { x: 40, f: 466, w: 88, h: 132 }, 1: { x: 140, f: 466, w: 88, h: 132 }, 2: { x: 90, f: 566, w: 100, h: 150 } };
const L = (kind: ScoreLine["kind"], pts: number, p: number): ScoreLine => ({ kind, pts, pos: p });

describe("riepilogo visivo dei punti", () => {
  it("totali del turno: dal più alto, a pari punti nell'ordine dato, anche chi non ha punti", () => {
    const lines = { a: [L("voto", 2, 1), L("lui", 4, 1)], b: [L("voto", 2, 2)], c: [], d: [L("voto", 2, 3)] };
    expect(totals(lines, ["c", "b", "a", "d"])).toEqual([{ id: "a", gain: 6 }, { id: "b", gain: 2 }, { id: "d", gain: 2 }, { id: "c", gain: 0 }]);
  });
  it("i riquadri stanno in basso sulla carta, dal più alto, con le icone dei motivi (bolt per il più veloce) e dentro la carta", () => {
    const toks = [{ p: 1, c: "#f00", id: "a" }, { p: 1, c: "#0f0", id: "b" }, { p: 2, c: "#00f", id: "c" }];
    const lines = { a: [L("mini-giusto", 2, 1), L("mini-veloce", 4, 1)], b: [L("mini-giusto", 2, 1)], c: [] };
    const chips = chipsFor(toks, lines, pos, () => "#000"), on1 = chips.filter((c) => c.pos === 1);
    expect(chips).toHaveLength(3);
    expect(on1.map((c) => [c.id, c.gain, c.fast])).toEqual([["a", 6, true], ["b", 2, false]]);
    expect(on1[0]!.icons).toEqual(["bolt", "target"]); expect(on1[1]!.icons).toEqual(["target"]);
    for (const c of chips) { const p = pos[c.pos - 1]!; expect(c.x).toBeGreaterThanOrEqual(p.x); expect(c.x + c.w).toBeLessThanOrEqual(p.x + p.w + 0.5); expect(c.y + c.h).toBeLessThanOrEqual(p.f - 6); expect(c.y).toBeGreaterThanOrEqual(p.f - 6 - p.h * 0.55); }
  });
  it("anche con 6 giocatori sulla stessa carta i riquadri non si sovrappongono e lasciano libera almeno metà carta", () => {
    const toks = ["a", "b", "c", "d", "e", "f"].map((id) => ({ p: 1, c: "#f00", id })), lines = Object.fromEntries(toks.map((t, i) => [t.id, [L("mini-giusto", i ? 2 : 6, 1)]]));
    const chips = chipsFor(toks, lines, pos, () => "#000");
    expect(chips).toHaveLength(6);
    for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) { const a = chips[i]!, b = chips[j]!; expect(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01).toBe(true); }
    expect(Math.min(...chips.map((c) => c.y))).toBeGreaterThanOrEqual(pos[0]!.f - 6 - pos[0]!.h * 0.55); expect(chips[0]!.h).toBeGreaterThanOrEqual(14);
  });
  it("i punti non legati a un voto (carta propria caduta, segnalino) compaiono sulla carta interessata, con la faccia del giocatore", () => {
    const toks = [{ p: 1, c: "#f00", id: "a" }];
    const lines = { a: [L("voto", 2, 1)], b: [L("carta", 2, 2)], c: [L("lui", 4, 2)] };   // b e c non hanno votato la carta 2
    const chips = chipsFor(toks, lines, pos, (id) => `col-${id}`), on2 = chips.filter((c) => c.pos === 2);
    expect(on2.map((c) => [c.id, c.gain])).toEqual([["c", 4], ["b", 2]]); expect(on2[0]!.color).toBe("col-c");
  });
  it("un giocatore che ha votato una carta senza prendere punti compare con 0", () => {
    const chips = chipsFor([{ p: 3, c: "#abc", id: "z" }], { z: [] }, pos, () => "");
    expect(chips).toHaveLength(1); expect(chips[0]!.gain).toBe(0);
  });
  it("gettoni senza giocatore (fantasmi di Propaganda!) non danno riquadri", () => {
    expect(chipsFor([{ p: 1, c: "#999" }], {}, pos, () => "")).toEqual([]);
  });
});

describe("Storia d'amore: gli innamorati stanno vicini", () => {
  it("partner e vincitore finiscono a meno di 70 px, i vincitori in più si stringono attorno al partner", () => {
    const f = buildFinale("amore", [1, 5, 3], [], () => 0.5), last = (k: string) => f.figs.find((x) => x.key === k)!.wps.slice().sort((a, b) => a.t - b.t).filter((w) => w.t < 3300 && (w.o ?? 1) === 1).pop()!;
    const p = last("side");
    for (const k of ["c1", "c5", "c3"]) { const w = last(k); expect(Math.hypot(w.x - p.x, w.y - p.y), k).toBeLessThan(90); }
    expect(Math.hypot(last("c1").x - p.x, last("c1").y - p.y)).toBeLessThan(70);
  });
});
