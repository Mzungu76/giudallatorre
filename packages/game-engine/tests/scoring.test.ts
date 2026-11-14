import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect } from "./helpers.ts";
import type { GameState } from "../src/index.ts";

/** Porta la partita al voto con il segnalino (tipo e carta) scelto rispetto alle posizioni reali. */
function setup(n: number, markAt: (g: GameState) => { slot: string; position: number }) {
  const g = toSuspect(start(n));
  return act(g, { type: "placeMarks", playerId: "p1", marks: [markAt(g)] });
}
const kinds = (r: { lines: Record<string, { kind: string }[]> }, p: string) => r.lines[p]!.map((x) => x.kind);
/** Punti di un giocatore senza i premi del segnalino. */
const base = (r: { points: Record<string, number>; lines: Record<string, { kind: string; pts: number }[]> }, p: string) => r.points[p]! - r.lines[p]!.filter((l) => l.kind === "lui" || l.kind === "lui-folla").reduce((a, l) => a + l.pts, 0);

describe("punteggi", () => {
  it("voto giusto +2 a chi vota il personaggio caduto; +2 a chi ha giocato la carta caduta (4 giocatori)", () => {
    const g = setup(4, (s) => ({ slot: "noncade", position: posOf(s, "p3") }));
    const fallen = posOf(g, "p4"), other = posOf(g, "p2");
    const r = castVotes(g, { p1: fallen, p2: fallen, p3: fallen, p4: other }).lastResult!;
    expect(r.fallenPosition).toBe(fallen);
    expect(base(r, "p1")).toBe(2); expect(base(r, "p2")).toBe(2); expect(base(r, "p3")).toBe(2); expect(base(r, "p4")).toBe(2);   // p4: votava un'altra carta ma la sua è caduta
  });
  it("tutti giocano una carta, il Megafono compreso: ogni carta della Torre ha un proprietario", () => {
    const g = toSuspect(start(5));
    expect(g.tower).toHaveLength(5); expect(g.tower.every((t) => t.ownerId !== null)).toBe(true);
    expect(new Set(g.tower.map((t) => t.ownerId)).size).toBe(5);
  });
  it("il Megafono può prendere voto + carta + segnalino nello stesso turno", () => {
    const g = setup(4, (s) => ({ slot: "cade", position: posOf(s, "p1") }));
    const f = posOf(g, "p1");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f }).lastResult!;
    expect(r.points.p1).toBe(2 + 2 + 4);          // voto + carta + CADE
  });
  it("niente malus: se il segnalino non riesce il Megafono non perde punti", () => {
    const g = setup(5, (s) => ({ slot: "cade", position: posOf(s, "p2") }));
    const f = posOf(g, "p3");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f, p5: f }).lastResult!;
    expect(kinds(r, "p1")).toContain("lui-mancato"); expect(r.points.p1).toBe(2);   // solo il voto giusto
  });
  it("i punti si accumulano tra i turni e restano al loro posto dopo 'advance'", () => {
    let g = setup(3, (s) => ({ slot: "noncade", position: posOf(s, "p2") }));
    const f = posOf(g, "p2");
    g = castVotes(g, { p1: f, p2: f, p3: f });
    const before = { ...g.scores };
    g = act(g, { type: "advance" });
    expect(g.scores).toEqual(before);
  });
});

describe("pareggio: se tra le pari merito c'è la carta del CADE cade solo lei; altrimenti cadono tutte", () => {
  it("pareggio 2-2 senza CADE tra le pari: cadono tutte le pari merito", () => {
    const g = setup(4, (s) => ({ slot: "noncade", position: posOf(s, "p4") }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    const r = castVotes(g, { p1: b, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.tie).toBe(true); expect(r.tieBreak).toBe(false); expect(r.fallenPositions).toEqual([a, b].sort((x, y) => x - y));
  });
  it("pareggio con la carta del CADE tra le pari: cade solo quella", () => {
    const g = setup(4, (s) => ({ slot: "cade", position: posOf(s, "p2") }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    const r = castVotes(g, { p1: b, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.tie).toBe(true); expect(r.tieBreak).toBe(true); expect(r.fallenPositions).toEqual([a]);
  });
  it("senza pareggio vince la maggioranza anche contro il Megafono", () => {
    const g = setup(4, () => ({ slot: "noncade", position: 1 }));
    const r = castVotes(g, { p1: 4, p2: 2, p3: 2, p4: 2 });
    expect(r.lastResult!.tie).toBe(false); expect(r.lastResult!.fallenPosition).toBe(2);
  });
  it("l'esito non dipende dall'ordine dei voti (azioni simultanee)", () => {
    const base0 = setup(5, () => ({ slot: "noncade", position: 2 }));
    const votes = { p1: 3, p2: 1, p3: 3, p4: 2, p5: 3 } as Record<string, number>;
    const orders = [["p1", "p2", "p3", "p4", "p5"], ["p5", "p4", "p3", "p2", "p1"], ["p3", "p1", "p5", "p2", "p4"]];
    const results = orders.map((o) => { let g = base0; for (const p of o) g = act(g, { type: "vote", playerId: p, position: votes[p]! }); return JSON.stringify(g.lastResult); });
    expect(new Set(results).size).toBe(1);
  });
});
