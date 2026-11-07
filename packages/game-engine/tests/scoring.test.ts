import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect } from "./helpers.ts";
import type { GameState } from "../src/index.ts";

/** Porta la partita al voto con il Lui! scelto rispetto alle posizioni reali. */
function setup(n: number, luiAt: (g: GameState) => { kind: "CADE" | "NON_CADE"; position: number }, extra = {}) {
  const g = toSuspect(start(n, extra));
  return act(g, { type: "placeLui", playerId: "p1", ...luiAt(g) });
}

describe("punteggi", () => {
  it("esempio del regolamento (5 giocatori): Megafono 2+1, due votanti 2, chi ha giocato la carta caduta 2, chi sbaglia 0", () => {
    // p1 Megafono(rosso), p2 blu, p3 giallo, p4 verde (ha giocato la carta caduta), p5 marrone
    const g = setup(5, (s) => ({ kind: "NON_CADE", position: posOf(s, "p5") }));
    const fallen = posOf(g, "p4"), other = posOf(g, "p5");
    const r = castVotes(g, { p1: fallen, p2: fallen, p3: fallen, p4: other, p5: other });
    expect(r.phase).toBe("RESULTS");
    expect(r.lastResult!.fallenPosition).toBe(fallen);
    expect(r.lastResult!.points).toEqual({ p1: 3, p2: 2, p3: 2, p4: 2, p5: 0 });
    expect(r.scores).toEqual({ p1: 3, p2: 2, p3: 2, p4: 2, p5: 0 });
  });
  it("Lui! CADE sul personaggio caduto: Megafono +4 (si somma agli altri punti)", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p2") }));
    const f = posOf(g, "p2"), o = posOf(g, "p3");
    const r = castVotes(g, { p1: f, p2: o, p3: f, p4: f });
    expect(r.lastResult!.points).toEqual({ p1: 6, p2: 2, p3: 0, p4: 0 }); // gregge: il Megafono indovina, i +2 dei votanti sono solo suoi (p1: voto 2 + lui 4; p2: carta 2)
  });
  it("Lui! CADE su un personaggio che NON cade: malus -1 (scommessa fallita)", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p3") }));
    const f = posOf(g, "p2");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f });
    expect(r.lastResult!.points.p1).toBe(1);                       // +2 voto, -1 malus
    expect(r.lastResult!.reasons.p1).toEqual(["voto", "lui-fallito"]);
  });
  it("Lui! NON_CADE: +1 se il personaggio resta su, malus -1 se cade", () => {
    let g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p3") }));
    let r = castVotes(g, { p1: posOf(g, "p2"), p2: posOf(g, "p2"), p3: posOf(g, "p2"), p4: posOf(g, "p2") });
    expect(r.lastResult!.points.p1).toBe(3);
    g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p2") }));
    r = castVotes(g, { p1: posOf(g, "p3"), p2: posOf(g, "p2"), p3: posOf(g, "p2"), p4: posOf(g, "p2") });
    expect(r.lastResult!.points.p1).toBe(-1);                      // il Megafono non ha votato il caduto e perde la scommessa
    expect(r.lastResult!.reasons.p1).toEqual(["lui-fallito"]);
  });
  it("il malus può portare il punteggio sotto zero (nessun limite inferiore)", () => {
    const g = setup(3, (s) => ({ kind: "CADE", position: posOf(s, "p3") }));
    const f = posOf(g, "p2"), other = f === 1 ? 2 : 1;
    // il Megafono vota un altro personaggio e la Folla fa cadere p2: p1 perde la scommessa e non prende punti
    const r = castVotes(g, { p1: other === posOf(g, "p3") ? (f === 3 ? 2 : 3) : other, p2: f, p3: f });
    expect(r.lastResult!.reasons.p1).toContain("lui-fallito");
    expect(r.scores.p1).toBe(-1);
  });
  it("nessuno vota il caduto e nessuno lo ha giocato (carta del mazzo): nessun punto ai votanti, né 'carta'", () => {
    const g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p2") }));
    const deck = posOf(g, null), others = [posOf(g, "p2"), posOf(g, "p3"), posOf(g, "p4")];
    const r = castVotes(g, { p1: deck, p2: deck, p3: deck, p4: deck });
    expect(r.lastResult!.fallenOwnerId).toBeNull();
    expect(r.lastResult!.points).toEqual({ p1: 2 + 1, p2: 2, p3: 2, p4: 2 }); // NON_CADE su p2 che resta su: +1
    expect(others).toHaveLength(3);
  });
  it("variante Megafono sa: il Megafono può prendere voto + carta + Lui! nello stesso turno (2+2+4)", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p1") }), { megafonoSa: true });
    const f = posOf(g, "p1");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f });
    expect(r.lastResult!.points.p1).toBe(8);
  });
  it("i punti si accumulano tra i turni", () => {
    let g = setup(3, (s) => ({ kind: "CADE", position: posOf(s, "p2") }));
    const f = posOf(g, "p2");
    g = castVotes(g, { p1: f, p2: f, p3: f });
    expect(g.scores).toEqual({ p1: 6, p2: 2, p3: 0 });
    g = act(g, { type: "advance" });
    expect(g.scores).toEqual({ p1: 6, p2: 2, p3: 0 });
  });
});

describe("spareggio: cade SEMPRE il personaggio votato dal Megafono", () => {
  it("pareggio 2-2: cade quello votato dal Megafono", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: 1 }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    const r = castVotes(g, { p1: b, p2: a, p3: b, p4: a });
    expect(r.lastResult!.tie).toBe(true);
    expect(r.lastResult!.fallenPosition).toBe(b);
  });
  it("tutti votano diversamente (1 voto a testa): cade il solo voto del Megafono", () => {
    const g = setup(4, () => ({ kind: "CADE", position: 1 }));
    const [a, b, c, d] = [1, 2, 3, 4];
    const r = castVotes(g, { p1: c, p2: a, p3: b, p4: d });
    expect(r.lastResult!.tie).toBe(true); expect(r.lastResult!.fallenPosition).toBe(c);
    expect(r.lastResult!.points.p1).toBe(1);                       // +2 voto, -1 Lui! CADE su un altro personaggio
  });
  it("il voto del Megafono non è tra i pareggiati: cade comunque il suo (gli altri voti non contano)", () => {
    const g = setup(5, () => ({ kind: "NON_CADE", position: 1 }));
    const r = castVotes(g, { p1: 5, p2: 1, p3: 1, p4: 2, p5: 2 });
    expect(r.lastResult!.tie).toBe(true); expect(r.lastResult!.fallenPosition).toBe(5);
    expect(r.lastResult!.points.p2).toBe(0);
  });
  it("senza pareggio vince la maggioranza anche contro il Megafono", () => {
    const g = setup(4, () => ({ kind: "CADE", position: 1 }));
    const r = castVotes(g, { p1: 4, p2: 2, p3: 2, p4: 2 });
    expect(r.lastResult!.tie).toBe(false); expect(r.lastResult!.fallenPosition).toBe(2);
  });
  it("l'esito non dipende dall'ordine dei voti (azioni simultanee)", () => {
    const base = setup(5, () => ({ kind: "CADE", position: 2 }));
    const votes = { p1: 3, p2: 1, p3: 3, p4: 2, p5: 3 } as Record<string, number>;
    const orders = [["p1", "p2", "p3", "p4", "p5"], ["p5", "p4", "p3", "p2", "p1"], ["p3", "p1", "p5", "p2", "p4"]];
    const results = orders.map((o) => { let g = base; for (const p of o) g = act(g, { type: "vote", playerId: p, position: votes[p]! }); return JSON.stringify(g.lastResult); });
    expect(new Set(results).size).toBe(1);
  });
});
