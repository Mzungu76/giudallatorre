import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect } from "./helpers.ts";
import type { GameState } from "../src/index.ts";

/** Porta la partita al voto con il Lui! scelto rispetto alle posizioni reali. */
function setup(n: number, luiAt: (g: GameState) => { kind: "CADE" | "NON_CADE"; position: number }, extra = {}) {
  const g = toSuspect(start(n, extra));
  return act(g, { type: "placeLui", playerId: "p1", ...luiAt(g) });
}

const kinds = (r: { lines: Record<string, { kind: string }[]> }, p: string) => r.lines[p]!.map((x) => x.kind);

describe("punteggi", () => {
  it("esempio del regolamento (5 giocatori): Megafono 2 (voto) + 2 (voti raccolti) + 1 (Lui!), votanti 2, chi ha giocato la carta caduta 2, chi sbaglia 0", () => {
    // p1 Megafono, p4 ha giocato la carta caduta, p5 la carta che resta su
    const g = setup(5, (s) => ({ kind: "NON_CADE", position: posOf(s, "p5") }));
    const fallen = posOf(g, "p4"), other = posOf(g, "p5");
    const r = castVotes(g, { p1: fallen, p2: fallen, p3: fallen, p4: other, p5: other });
    expect(r.phase).toBe("RESULTS");
    expect(r.lastResult!.fallenPosition).toBe(fallen);
    expect(r.lastResult!.collected).toBe(2);
    expect(r.lastResult!.points).toEqual({ p1: 5, p2: 2, p3: 2, p4: 2, p5: 0 });
    expect(r.scores).toEqual({ p1: 5, p2: 2, p3: 2, p4: 2, p5: 0 });
  });
  it("il Megafono somma 1 punto per ogni voto degli altri sulla sua carta (il suo voto non conta), anche se la carta NON cade", () => {
    // p1 vota la n. di p5; p2 e p3 votano la stessa; p4 e p5 votano p4: cade la carta di p4? 2 contro 3 → cade quella di p5
    const g = setup(5, (s) => ({ kind: "NON_CADE", position: posOf(s, "p4") }));
    const a = posOf(g, "p5"), b = posOf(g, "p4");
    const r = castVotes(g, { p1: b, p2: a, p3: a, p4: b, p5: a }).lastResult!;
    expect(r.fallenPosition).toBe(a);
    expect(r.collected).toBe(1);                                    // solo p4 ha votato come il Megafono
    expect(r.points.p1).toBe(1 + 1);                               // 1 voto raccolto + NON CADE azzeccato; la carta non cade: niente +2 del voto
    expect(kinds(r, "p1")).toEqual(["raccolti", "lui-non-cade"]);
    expect(r.points.p4).toBe(0);
  });
  it("se la carta del Megafono cade, oltre ai voti raccolti prende +2 (esempio: 3 voti degli altri + 2 = 5)", () => {
    const g = setup(5, (s) => ({ kind: "NON_CADE", position: posOf(s, "p5") }));
    const f = posOf(g, "p4"), o = posOf(g, "p5");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f, p5: o }).lastResult!;
    expect(r.collected).toBe(3);
    expect(r.points.p1).toBe(3 + 2 + 1);                           // raccolti + voto giusto + Lui! NON CADE azzeccato
    expect(kinds(r, "p1")).toEqual(["voto", "raccolti", "lui-non-cade"]);
  });
  it("Lui! CADE sul personaggio caduto: Megafono +4 (si somma agli altri punti)", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p2") }));
    const f = posOf(g, "p2"), o = posOf(g, "p3");
    const r = castVotes(g, { p1: f, p2: o, p3: f, p4: f });
    expect(r.lastResult!.points).toEqual({ p1: 2 + 2 + 4, p2: 2, p3: 2, p4: 2 });   // p1: voto + 2 raccolti + Lui!; p2: carta caduta
  });
  it("Lui! CADE su un personaggio che NON cade: malus -1 (scommessa fallita)", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p3") }));
    const f = posOf(g, "p2");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f });
    expect(r.lastResult!.points.p1).toBe(2 + 3 - 1);                // voto + 3 raccolti − malus
    expect(kinds(r.lastResult!, "p1")).toEqual(["voto", "raccolti", "lui-fallito"]);
  });
  it("Lui! NON_CADE: +1 se il personaggio resta su, malus -1 se cade", () => {
    let g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p3") }));
    let r = castVotes(g, { p1: posOf(g, "p2"), p2: posOf(g, "p2"), p3: posOf(g, "p2"), p4: posOf(g, "p2") });
    expect(r.lastResult!.points.p1).toBe(2 + 3 + 1);
    g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p2") }));
    r = castVotes(g, { p1: posOf(g, "p3"), p2: posOf(g, "p2"), p3: posOf(g, "p2"), p4: posOf(g, "p2") });
    expect(r.lastResult!.points.p1).toBe(-1);                      // il Megafono non ha votato il caduto, nessuno lo ha seguito e perde la scommessa
    expect(kinds(r.lastResult!, "p1")).toEqual(["lui-fallito"]);
  });
  it("il malus può portare il punteggio sotto zero (nessun limite inferiore)", () => {
    const g = setup(3, (s) => ({ kind: "CADE", position: posOf(s, "p3") }));
    const f = posOf(g, "p2"), other = posOf(g, "p3");
    const r = castVotes(g, { p1: other, p2: f, p3: f });
    expect(kinds(r.lastResult!, "p1")).toContain("lui-fallito");
    expect(r.scores.p1).toBe(-1);
  });
  it("nessuno ha giocato il caduto (carta del mazzo): nessun +2 della carta", () => {
    const g = setup(4, (s) => ({ kind: "NON_CADE", position: posOf(s, "p2") }));
    const deck = posOf(g, null);
    const r = castVotes(g, { p1: deck, p2: deck, p3: deck, p4: deck });
    expect(r.lastResult!.fallenOwnerId).toBeNull();
    expect(r.lastResult!.points).toEqual({ p1: 2 + 3 + 1, p2: 2, p3: 2, p4: 2 });
  });
  it("variante Megafono sa: il Megafono può prendere voto + voti raccolti + carta + Lui! nello stesso turno", () => {
    const g = setup(4, (s) => ({ kind: "CADE", position: posOf(s, "p1") }), { megafonoSa: true });
    const f = posOf(g, "p1");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f });
    expect(r.lastResult!.points.p1).toBe(2 + 3 + 2 + 4);
  });
  it("i punti si accumulano tra i turni", () => {
    let g = setup(3, (s) => ({ kind: "CADE", position: posOf(s, "p2") }));
    const f = posOf(g, "p2");
    g = castVotes(g, { p1: f, p2: f, p3: f });
    expect(g.scores).toEqual({ p1: 2 + 2 + 4, p2: 2 + 2, p3: 2 });
    g = act(g, { type: "advance" });
    expect(g.scores).toEqual({ p1: 8, p2: 4, p3: 2 });
  });
});

describe("pareggio: cadono insieme tutte le carte a pari merito (anche quella votata dal Megafono)", () => {
  it("pareggio 2-2: cadono entrambe le carte; chi le ha giocate e chi le ha votate prende i punti", () => {
    const g = setup(4, () => ({ kind: "NON_CADE", position: 1 }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    const r = castVotes(g, { p1: b, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([a, b].sort((x, y) => x - y)); expect(r.fallenPosition).toBe(r.fallenPositions[0]);
    expect(r.points.p2).toBe(2 + 2); expect(r.points.p3).toBe(2 + 2); expect(r.points.p4).toBe(2);
    expect(r.points.p1).toBe(2 + 1 + (r.fallenPositions.includes(1) ? -1 : 1));   // voto giusto + 1 raccolto (p3) + Lui! NON CADE
  });
  it("tutti votano diversamente (1 voto a testa): cadono tutte le carte votate", () => {
    const g = setup(4, () => ({ kind: "NON_CADE", position: 1 }));
    const r = castVotes(g, { p1: 3, p2: 1, p3: 2, p4: 4 }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([1, 2, 3, 4]); expect(r.fallenCardIds).toHaveLength(4);
    expect(r.points.p1).toBe(2 - 1 + (r.fallenOwnerIds.includes("p1") ? 2 : 0));   // voto giusto, Lui! NON CADE sbagliato; nessuno ha votato come lui
  });
  it("più carte cadute: ogni giocatore che le aveva giocate prende il +2 della carta, ogni votante di una caduta il +2 del voto, e il Lui! conta se la sua carta è tra le cadute", () => {
    const g = setup(5, () => ({ kind: "CADE", position: 2 }));
    const r = castVotes(g, { p1: 5, p2: 2, p3: 2, p4: 1, p5: 1 }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([1, 2]);
    expect(r.points.p1).toBe(4 + r.fallenOwnerIds.reduce((n, o) => n + (o === "p1" ? 2 : 0), 0));  // +4 Lui! CADE sulla n.2 caduta
    for (const o of r.fallenOwnerIds) if (o && o !== "p1") expect(kinds(r, o)).toContain("carta");
    for (const p of ["p2", "p3", "p4", "p5"]) expect(kinds(r, p)).toContain("voto");
  });
  it("il Megafono vota una delle carte in parità: cade anche la sua, e prende voto + voti raccolti", () => {
    const g = setup(4, () => ({ kind: "NON_CADE", position: 3 }));
    const r = castVotes(g, { p1: 1, p2: 1, p3: 2, p4: 2 }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([1, 2]);
    expect(r.points.p1).toBe(2 + 1 + 1 + (r.fallenOwnerIds.includes("p1") ? 2 : 0));   // voto + 1 raccolto (p2) + Lui! NON CADE sulla n.3
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
