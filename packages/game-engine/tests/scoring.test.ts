import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect } from "./helpers.ts";
import { luiAvailable, luiTokens } from "../src/index.ts";
import type { GameState, LuiSlot } from "../src/index.ts";

/** Porta la partita al voto con il Lui! (segnalino e carta) scelto rispetto alle posizioni reali. */
function setup(n: number, luiAt: (g: GameState) => { slot: LuiSlot; position: number }, extra = {}) {
  const g = toSuspect(start(n, extra));
  return act(g, { type: "placeLui", playerId: "p1", ...luiAt(g) });
}
const kinds = (r: { lines: Record<string, { kind: string }[]> }, p: string) => r.lines[p]!.map((x) => x.kind);
const noLui = (r: { points: Record<string, number>; lines: Record<string, { kind: string; pts: number }[]> }, p: string) => r.points[p]! - r.lines[p]!.filter((l) => l.kind === "lui").reduce((a, l) => a + l.pts, 0);

describe("segnalini Lui! (tabella e monouso)", () => {
  it("i valori dei segnalini per numero di giocatori (soglia = voti degli altri, punti = 2 × soglia; lo 0 paga una cifra fissa)", () => {
    const t = (n: number) => luiTokens(n).map((x) => `${x.slot}:${x.k}→${x.pts}`).join(" ");
    expect(t(3)).toBe("bassa:1→2 alta:2→4 zero:0→2");
    expect(t(4)).toBe("bassa:1→2 alta:3→6 zero:0→2");
    expect(t(5)).toBe("bassa:2→4 alta:3→6 zero:0→3");
    expect(t(6)).toBe("bassa:2→4 alta:4→8 zero:0→3");
    expect(t(8)).toBe("bassa:2→4 alta:4→8 zero:0→3");
    for (let n = 3; n <= 8; n++) for (const x of luiTokens(n)) if (x.slot !== "zero") expect(x.k).toBeLessThanOrEqual(n - 1);   // gli altri sono N−1
  });
  it("un segnalino speso non si può riusare; finiti tutti, tornano tutti", () => {
    let g = setup(4, () => ({ slot: "bassa", position: 1 }));
    g = castVotes(g, { p1: 1, p2: 1, p3: 1, p4: 1 });
    expect(g.luiSpent!.p1).toEqual(["bassa"]); expect(luiAvailable(g, "p1")).toEqual(["alta", "zero"]);
    expect(luiAvailable(g, "p2")).toEqual(["bassa", "alta", "zero"]);
    const used = { ...g, luiSpent: { ...g.luiSpent, p1: ["bassa", "alta", "zero"] as LuiSlot[] } };
    expect(luiAvailable(used, "p1")).toEqual(["bassa", "alta", "zero"]);
  });
  it("in partita: non si può posare un segnalino già usato", () => {
    const g = toSuspect(start(4));
    const spent: GameState = { ...g, luiSpent: { ...g.luiSpent, p1: ["alta"] } };
    expect(() => act(spent, { type: "placeLui", playerId: "p1", slot: "alta", position: 1 })).toThrow(/già usato/);
    expect(act(spent, { type: "placeLui", playerId: "p1", slot: "bassa", position: 1 }).phase).toBe("VOTE");
  });
});

describe("punteggi", () => {
  it("voto giusto +2 a chi vota il personaggio caduto; +2 a chi ha giocato la carta caduta (4 giocatori)", () => {
    // Lui! zero sulla carta di p5? qui 4 giocatori: Lui! sulla carta di p3, che nessuno vota
    const g = setup(4, (s) => ({ slot: "zero", position: posOf(s, "p3") }));
    const fallen = posOf(g, "p4"), other = posOf(g, "p2");
    const r = castVotes(g, { p1: fallen, p2: fallen, p3: fallen, p4: other }).lastResult!;
    expect(r.fallenPosition).toBe(fallen);
    expect(noLui(r, "p1")).toBe(2); expect(noLui(r, "p2")).toBe(2); expect(noLui(r, "p3")).toBe(2); expect(noLui(r, "p4")).toBe(2);   // p4: votava un'altra carta ma la sua è caduta
  });
  it("soglia: il Megafono prende i punti stampati se la carta del Lui! riceve ALMENO k voti degli altri (il suo voto non conta)", () => {
    // 4 giocatori: bassa = almeno 1 voto → 2 punti
    let g = setup(4, (s) => ({ slot: "bassa", position: posOf(s, "p2") }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    let r = castVotes(g, { p1: a, p2: b, p3: b, p4: a }).lastResult!;
    expect(r.lui).toMatchObject({ slot: "bassa", k: 1, pts: 2, others: 1, hit: true });
    expect(kinds(r, "p1")).toContain("lui"); expect(r.points.p1).toBe(noLui(r, "p1") + 2);
    // solo il Megafono vota la sua carta Lui!: 0 voti degli altri → mancato
    g = setup(4, (s) => ({ slot: "bassa", position: posOf(s, "p2") }));
    r = castVotes(g, { p1: posOf(g, "p2"), p2: b, p3: b, p4: b }).lastResult!;
    expect(r.lui).toMatchObject({ others: 0, hit: false }); expect(kinds(r, "p1")).toContain("lui-mancato"); expect(kinds(r, "p1")).not.toContain("lui");
  });
  it("soglia alta (4 giocatori: almeno 3 voti degli altri = 6 punti)", () => {
    const g = setup(4, (s) => ({ slot: "alta", position: posOf(s, "p2") }));
    const a = posOf(g, "p2");
    const r = castVotes(g, { p1: a, p2: a, p3: a, p4: a }).lastResult!;
    expect(r.lui).toMatchObject({ slot: "alta", k: 3, pts: 6, others: 3, hit: true });
    expect(r.points.p1).toBe(2 + 6);            // voto giusto (la carta cade) + Lui!
  });
  it("lo 0 secco: riesce solo se NESSUN altro vota la carta; un solo voto lo manda a vuoto", () => {
    let g = setup(4, (s) => ({ slot: "zero", position: posOf(s, "p3") }));
    const a = posOf(g, "p2"), c = posOf(g, "p3");
    let r = castVotes(g, { p1: c, p2: a, p3: a, p4: a }).lastResult!;     // il Megafono vota la propria carta Lui!: non conta
    expect(r.lui).toMatchObject({ slot: "zero", pts: 2, others: 0, hit: true });
    g = setup(4, (s) => ({ slot: "zero", position: posOf(s, "p3") }));
    r = castVotes(g, { p1: a, p2: c, p3: a, p4: a }).lastResult!;
    expect(r.lui).toMatchObject({ others: 1, hit: false }); expect(r.points.p1).toBe(noLui(r, "p1"));
  });
  it("niente malus: se la scommessa fallisce il Megafono non perde punti (il segnalino è speso)", () => {
    const g = setup(5, (s) => ({ slot: "alta", position: posOf(s, "p2") }));
    const f = posOf(g, "p3");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f, p5: f }).lastResult!;
    expect(r.lui!.hit).toBe(false); expect(r.points.p1).toBe(2);           // solo il voto giusto
    expect(g.luiSpent!.p1).toEqual([]);                                     // prima del turno nulla era speso
  });
  it("nessuno ha giocato il caduto (carta del mazzo): nessun +2 della carta", () => {
    const g = setup(4, (s) => ({ slot: "bassa", position: posOf(s, "p2") }));
    const deck = posOf(g, null);
    const r = castVotes(g, { p1: deck, p2: deck, p3: deck, p4: deck }).lastResult!;
    expect(r.fallenOwnerId).toBeNull();
    for (const p of ["p1", "p2", "p3", "p4"]) expect(kinds(r, p)).not.toContain("carta");
  });
  it("variante Megafono sa: il Megafono può prendere voto + carta + Lui! nello stesso turno", () => {
    const g = setup(4, (s) => ({ slot: "bassa", position: posOf(s, "p1") }), { megafonoSa: true });
    const f = posOf(g, "p1");
    const r = castVotes(g, { p1: f, p2: f, p3: f, p4: f }).lastResult!;
    expect(r.points.p1).toBe(2 + 2 + 2);          // voto + carta + Lui! bassa (3 voti degli altri ≥ 1)
  });
  it("i punti si accumulano tra i turni e restano al loro posto dopo 'advance'", () => {
    let g = setup(3, (s) => ({ slot: "bassa", position: posOf(s, "p2") }));
    const f = posOf(g, "p2");
    g = castVotes(g, { p1: f, p2: f, p3: f });
    const before = { ...g.scores };
    g = act(g, { type: "advance" });
    expect(g.scores).toEqual(before);
  });
});

describe("pareggio: cadono insieme tutte le carte a pari merito (anche quella votata dal Megafono)", () => {
  it("pareggio 2-2: cadono entrambe le carte; chi le ha giocate e chi le ha votate prende i punti", () => {
    const g = setup(4, () => ({ slot: "zero", position: 1 }));
    const a = posOf(g, "p2"), b = posOf(g, "p3");
    const r = castVotes(g, { p1: b, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([a, b].sort((x, y) => x - y)); expect(r.fallenPosition).toBe(r.fallenPositions[0]);
    expect(noLui(r, "p2")).toBe(2 + 2); expect(noLui(r, "p3")).toBe(2 + 2); expect(noLui(r, "p4")).toBe(2); expect(noLui(r, "p1")).toBe(2);
  });
  it("tutti votano diversamente (1 voto a testa): cadono tutte le carte votate", () => {
    const g = setup(4, () => ({ slot: "zero", position: 1 }));
    const r = castVotes(g, { p1: 3, p2: 1, p3: 2, p4: 4 }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([1, 2, 3, 4]); expect(r.fallenCardIds).toHaveLength(4);
    expect(noLui(r, "p1")).toBe(2 + (r.fallenOwnerIds.includes("p1") ? 2 : 0));
  });
  it("più carte cadute: ogni giocatore che le aveva giocate prende il +2 della carta e ogni votante di una caduta il +2 del voto", () => {
    const g = setup(5, () => ({ slot: "bassa", position: 2 }));
    const r = castVotes(g, { p1: 5, p2: 2, p3: 2, p4: 1, p5: 1 }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([1, 2]);
    for (const o of r.fallenOwnerIds) if (o && o !== "p1") expect(kinds(r, o)).toContain("carta");
    for (const p of ["p2", "p3", "p4", "p5"]) expect(kinds(r, p)).toContain("voto");
    expect(kinds(r, "p1")).not.toContain("voto");
  });
  it("senza pareggio vince la maggioranza anche contro il Megafono", () => {
    const g = setup(4, () => ({ slot: "bassa", position: 1 }));
    const r = castVotes(g, { p1: 4, p2: 2, p3: 2, p4: 2 });
    expect(r.lastResult!.tie).toBe(false); expect(r.lastResult!.fallenPosition).toBe(2);
  });
  it("l'esito non dipende dall'ordine dei voti (azioni simultanee)", () => {
    const base = setup(5, () => ({ slot: "bassa", position: 2 }));
    const votes = { p1: 3, p2: 1, p3: 3, p4: 2, p5: 3 } as Record<string, number>;
    const orders = [["p1", "p2", "p3", "p4", "p5"], ["p5", "p4", "p3", "p2", "p1"], ["p3", "p1", "p5", "p2", "p4"]];
    const results = orders.map((o) => { let g = base; for (const p of o) g = act(g, { type: "vote", playerId: p, position: votes[p]! }); return JSON.stringify(g.lastResult); });
    expect(new Set(results).size).toBe(1);
  });
});
