import { describe, expect, it } from "vitest";
import { act, castVotes, cfg, posOf, start } from "./helpers.ts";
import { applyAction, chooseBotAction, createGame, luiTokens, megafonoOf, newBotMemory, requiredPlayers, viewFor } from "../src/index.ts";
import type { GameState } from "../src/index.ts";

/** Gioco base «Cade / Non cade»: il Megafono gioca dalla mano e posa 2 segnalini coperti (CADE +4, NON CADE +2, VOTI NULLI!), premi condivisi con chi vota la carta. */
const C = (n: number, extra = {}) => {
  let g = start(n, { ...extra });
  g = act(g, { type: "choosePhrase", playerId: megafonoOf(g), mode: "card", index: 0 });
  for (const p of requiredPlayers(g)) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! });
  return g;
};
const place = (g: GameState, slot: string, position: number) => act(g, { type: "placeMarks", playerId: "p1", marks: [{ slot, position }] });
const pos = (g: GameState) => ({ m: posOf(g, "p1"), a: posOf(g, "p2"), b: posOf(g, "p3"), c: posOf(g, "p4") });

describe("gioco base «Cade / Non cade»", () => {
  it("il Megafono gioca sempre dalla mano; i tre segnalini sono sempre gli stessi", () => {
    const g = C(4);
    expect(g.tower).toHaveLength(4); expect(g.tower.some((t) => t.ownerId === "p1")).toBe(true);
    expect(luiTokens(g).map((x) => x.slot)).toEqual(["cade", "noncade", "nulli"]);
    expect(viewFor(g, "p2").luiTokens.map((x) => x.slot)).toEqual(["cade", "noncade", "nulli"]);
  });

  it("si posa un solo segnalino tra i tre; gli altri vedono dove, non quale", () => {
    const g = C(4), { a, b } = pos(g);
    expect(() => act(g, { type: "placeMarks", playerId: "p1", marks: [{ slot: "cade", position: a }, { slot: "nulli", position: b }] })).toThrow(/un solo segnalino/);
    expect(() => act(g, { type: "placeMarks", playerId: "p1", marks: [] })).toThrow(/un solo segnalino/);
    expect(() => act(g, { type: "placeMarks", playerId: "p2", marks: [{ slot: "cade", position: a }] })).toThrow(/solo il Megafono/);
    const v = place(g, "cade", a);
    expect(v.phase).toBe("VOTE");
    expect(viewFor(v, "p1").marks).toEqual([{ position: a, slot: "cade" }]);
    expect(viewFor(v, "p3").marks).toEqual([{ position: a, slot: null }]);
  });

  it("il Megafono non può votare la carta con VOTI NULLI!; gli altri sì", () => {
    const g0 = C(4), { b } = pos(g0), g = place(g0, "nulli", b);
    expect(() => act(g, { type: "vote", playerId: "p1", position: b })).toThrow(/Voti nulli/);
    expect(act(g, { type: "vote", playerId: "p2", position: b }).votes.p2).toBe(b);
    expect(viewFor(g, "p1").myForbidden).toBe(b); expect(viewFor(g, "p2").myForbidden).toBeNull();
  });

  it("CADE: se la carta cade, +4 al Megafono (ovunque abbia votato, una volta sola) e +4 a chi della Folla l'ha votata; pareggio vinto dalla carta del CADE", () => {
    const g0 = C(4), { m, a, b } = pos(g0);
    const r = castVotes(place(g0, "cade", a), { p1: b, p2: a, p3: a, p4: b }).lastResult!;   // a 2, b 2: vince la carta del CADE
    expect(r.tie).toBe(true); expect(r.tieBreak).toBe(true); expect(r.fallenPositions).toEqual([a]);
    expect(r.points).toEqual({ p1: 4, p2: 2 + 2 + 4, p3: 2 + 4, p4: 0 });
    expect(r.marks).toEqual([{ slot: "cade", effect: "cade", position: a, hit: true, voters: ["p2", "p3"] }]);
    const r2 = castVotes(place(g0, "cade", m), { p1: m, p2: m, p3: b, p4: a }).lastResult!;
    expect(r2.fallenPositions).toEqual([m]); expect(r2.points.p1).toBe(2 + 2 + 4); expect(r2.points.p2).toBe(2 + 4);
    const r3 = castVotes(place(g0, "cade", a), { p1: b, p2: b, p3: a, p4: b }).lastResult!;
    expect(r3.fallenPositions).toEqual([b]); expect(r3.lines.p1!.map((l) => l.kind)).toContain("lui-mancato"); expect(r3.points.p3).toBe(2);   // la sua carta b è caduta; nessun malus per il CADE mancato
  });

  it("NON CADE: se la carta resta su, +2 al Megafono e a chi l'ha votata; se cade, niente", () => {
    const g0 = C(4), { a, b } = pos(g0);
    let r = castVotes(place(g0, "noncade", a), { p1: b, p2: a, p3: b, p4: b }).lastResult!;
    expect(r.fallenPositions).toEqual([b]); expect(r.points.p2).toBe(2); expect(r.points.p1).toBe(2 + 2);
    r = castVotes(place(g0, "noncade", a), { p1: a, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.fallenPositions).toEqual([a]); expect(r.lines.p1!.map((l) => l.kind)).toContain("lui-mancato"); expect(r.points.p1).toBe(2);
  });

  it("VOTI NULLI!: i voti sulla carta non valgono (cambia la maggioranza) e chi l'ha votata non prende il +2", () => {
    const g0 = C(4), { a, b } = pos(g0);
    const r = castVotes(place(g0, "nulli", a), { p1: b, p2: a, p3: a, p4: a }).lastResult!;
    expect(r.counts).toEqual({ [b]: 1 }); expect(r.fallenPositions).toEqual([b]);
    expect(r.marks![0]).toMatchObject({ effect: "nulli", hit: true, caught: ["p2", "p3", "p4"] });
    expect(r.points.p2).toBe(0); expect(r.points.p3).toBe(2);   // p3: la sua carta b è caduta
  });

  it("pareggio senza la carta del CADE: cadono tutte le pari (il voto del Megafono non decide)", () => {
    const g0 = C(4), { a, b, c } = pos(g0);
    const r = castVotes(place(g0, "cade", c), { p1: a, p2: a, p3: b, p4: b }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([a, b].sort((x, y) => x - y)); expect(r.tieBreak).toBe(false);
  });

  it("con 3 giocatori valgono le stesse regole", () => {
    const g0 = C(3); expect(g0.tower).toHaveLength(3);
    const [x, y, z] = g0.tower.map((t) => t.position) as [number, number, number];
    const r = castVotes(place(g0, "cade", x), { p1: z, p2: x, p3: y }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([x]);   // 1-1-1: vince il CADE
  });

  it("i bot giocano il gioco base fino in fondo, da 3 a 8 giocatori, senza azioni illegali", () => {
    for (const n of [3, 4, 6, 8]) for (const level of ["easy", "medium", "hard"] as const) {
      let s = createGame({ ...cfg(n, { seed: 21 + n, miniGame: false }) }).state;
      const mem = newBotMemory(); let seed = 5; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 3000 && s.phase !== "GAME_OVER"; i++) {
        if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
        const a = s.playerIds.map((p) => chooseBotAction(s, p, level, mem, rand)).find((x) => x);
        s = applyAction(s, a!).state;
      }
      expect(s.phase, `${n} ${level}`).toBe("GAME_OVER");
    }
  });
});
