import { describe, expect, it } from "vitest";
import type { ScoreLine } from "@gdt/game-engine";
import { iconPts, sunk, totals, visibleRect } from "../src/lib/results.ts";
import type { CardPos } from "../src/lib/results.ts";
import { buildFinale } from "../src/lib/miniScenes.ts";

const pos: Record<number, CardPos> = { 0: { x: 40, f: 466, w: 88, h: 132 }, 1: { x: 140, f: 466, w: 88, h: 132 }, 2: { x: 90, f: 566, w: 100, h: 150 } };
const L = (kind: ScoreLine["kind"], pts: number, p: number): ScoreLine => ({ kind, pts, pos: p });

describe("riepilogo visivo dei punti", () => {
  it("totali del turno: dal più alto, a pari punti nell'ordine dato, anche chi non ha punti", () => {
    const lines = { a: [L("voto", 2, 1), L("lui", 4, 1)], b: [L("voto", 2, 2)], c: [], d: [L("voto", 2, 3)] };
    expect(totals(lines, ["c", "b", "a", "d"])).toEqual([{ id: "a", gain: 6 }, { id: "b", gain: 2 }, { id: "d", gain: 2 }, { id: "c", gain: 0 }]);
  });
  it("la parte visibile di una carta dietro finisce dove iniziano le carte davanti; quella davanti si vede tutta", () => {
    const back = visibleRect(pos, 0), front = visibleRect(pos, 2);
    expect(back.y + back.h).toBeLessThanOrEqual(pos[2]!.f - pos[2]!.h - 6);   // sopra il bordo alto della carta davanti
    expect(front.y + front.h).toBeGreaterThan(pos[2]!.f - 30);
    expect(visibleRect(sunk(pos, [1]), 0).y).toBeGreaterThan(back.y);          // abbassata: la parte visibile scende
  });
  it("le icone dei motivi sommano i punti dello stesso motivo, il ⚡ per primo, e saltano gli zeri", () => {
    const ic = iconPts([L("mini-giusto", 2, 1), L("carta", 2, 1), L("mini-veloce", 4, 1), L("voto", 2, 2), L("lui-mancato", 0, 1)]);
    expect(ic).toEqual([{ k: "bolt", pts: 4 }, { k: "target", pts: 4 }, { k: "card", pts: 2 }]);
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
