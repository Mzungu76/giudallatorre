import { describe, expect, it } from "vitest";
import { act, castVotes, cfg, posOf, start } from "./helpers.ts";
import { applyAction, chooseBotAction, createGame, luiTokens, megafonoOf, newBotMemory, requiredPlayers, viewFor } from "../src/index.ts";
import type { GameState } from "../src/index.ts";

/** Gioco base «Cade / Non cade»: il Megafono gioca dalla mano e posa 2 segnalini coperti (CADE +4, NON CADE +1, VOTI NULLI!), premi condivisi con chi vota la carta. */
const C = (n: number, extra = {}) => {
  let g = start(n, { cnc: true, luiSlots: undefined, ...extra });
  g = act(g, { type: "choosePhrase", playerId: megafonoOf(g), mode: "card", index: 0 });
  for (const p of requiredPlayers(g)) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! });
  return g;
};
const place = (g: GameState, a: [string, number], b: [string, number]) => act(g, { type: "placeMarks", playerId: "p1", marks: [{ slot: a[0], position: a[1] }, { slot: b[0], position: b[1] }] });
const pos = (g: GameState) => ({ m: posOf(g, "p1"), a: posOf(g, "p2"), b: posOf(g, "p3"), c: posOf(g, "p4") });

describe("gioco base «Cade / Non cade»", () => {
  it("il Megafono gioca sempre dalla mano; i tre segnalini; senza cnc resta il gioco di prima", () => {
    const g = C(4);
    expect(g.megafonoSa).toBe(true); expect(g.tower).toHaveLength(4); expect(g.tower.some((t) => t.ownerId === "p1")).toBe(true);
    expect(luiTokens(g).map((x) => x.slot)).toEqual(["cade", "noncade", "nulli"]);
    expect(viewFor(g, "p2").cnc).toBe(true);
    const old = createGame(cfg(4)).state; expect(old.cnc).toBe(false); expect(old.megafonoSa).toBe(false);
    // «Il gregge» e PROPAGANDA restano varianti a sé
    expect(createGame({ ...cfg(4, { cnc: true, gregge: true }), luiSlots: undefined }).state.cnc).toBe(false);
  });

  it("si posano esattamente 2 segnalini diversi su 2 carte diverse; gli altri vedono dove, non quali", () => {
    const g = C(4), { a, b } = pos(g);
    expect(() => act(g, { type: "placeMarks", playerId: "p1", marks: [{ slot: "cade", position: a }] })).toThrow(/2 segnalini/);
    expect(() => place(g, ["cade", a], ["cade", b])).toThrow(/diversi/);
    expect(() => place(g, ["cade", a], ["nulli", a])).toThrow(/due carte diverse/);
    expect(() => act(g, { type: "placeMarks", playerId: "p2", marks: [{ slot: "cade", position: a }, { slot: "nulli", position: b }] })).toThrow(/solo il Megafono/);
    expect(() => act(g, { type: "placeLui", playerId: "p1", slot: "cade", position: a })).toThrow(/2 segnalini/);
    const v = place(g, ["cade", a], ["nulli", b]);
    expect(v.phase).toBe("VOTE");
    expect(viewFor(v, "p1").marks).toEqual([{ position: a, slot: "cade" }, { position: b, slot: "nulli" }]);
    expect(viewFor(v, "p3").marks).toEqual([{ position: a, slot: null }, { position: b, slot: null }]);
  });

  it("il Megafono non può votare la carta con VOTI NULLI!; gli altri sì", () => {
    const g = place(C(4), ["cade", pos(C(4)).a], ["nulli", pos(C(4)).b]), { b } = pos(g);
    expect(() => act(g, { type: "vote", playerId: "p1", position: b })).toThrow(/Voti nulli/);
    expect(act(g, { type: "vote", playerId: "p2", position: b }).votes.p2).toBe(b);
    expect(viewFor(g, "p1").myForbidden).toBe(b); expect(viewFor(g, "p2").myForbidden).toBeNull();
  });

  it("CADE: se la carta cade, +4 al Megafono (ovunque abbia votato, una volta sola) e +4 a chi della Folla l'ha votata", () => {
    const g0 = C(4), { m, a, b, c } = pos(g0);
    const r = castVotes(place(g0, ["cade", a], ["noncade", c]), { p1: b, p2: a, p3: a, p4: b }).lastResult!;   // a 2, b 2: pareggio, vince la carta del CADE
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([a]);
    expect(r.points).toEqual({ p1: 4 + 1, p2: 2 + 2 + 4, p3: 2 + 4, p4: 0 });   // Megafono: CADE +4 e NON CADE +1 (c non cade)
    expect(r.marks).toEqual([{ slot: "cade", effect: "cade", position: a, hit: true, voters: ["p2", "p3"] }, { slot: "noncade", effect: "noncade", position: c, hit: true, voters: [] }]);
    // il Megafono che vota la carta del CADE prende il +4 una volta sola
    const r2 = castVotes(place(g0, ["cade", m], ["noncade", c]), { p1: m, p2: m, p3: b, p4: a }).lastResult!;
    expect(r2.fallenPositions).toEqual([m]); expect(r2.points.p1).toBe(2 + 2 + 4 + 1); expect(r2.points.p2).toBe(2 + 4);
  });

  it("NON CADE: se la carta resta su, +1 al Megafono e a chi l'ha votata; se cade, niente (nessun malus)", () => {
    const g0 = C(4), { a, b, c } = pos(g0);
    let r = castVotes(place(g0, ["noncade", a], ["nulli", c]), { p1: b, p2: a, p3: b, p4: b }).lastResult!;
    expect(r.fallenPositions).toEqual([b]); expect(r.points.p2).toBe(1); expect(r.points.p1).toBe(2 + 1);
    r = castVotes(place(g0, ["noncade", a], ["nulli", c]), { p1: a, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.fallenPositions).toEqual([a]); expect(r.lines.p1!.map((l) => l.kind)).toContain("lui-mancato"); expect(r.points.p1).toBe(2);
  });

  it("VOTI NULLI!: i voti sulla carta non valgono (cambia la maggioranza) e chi l'ha votata non prende il +2", () => {
    const g0 = C(4), { a, b, c } = pos(g0);
    const r = castVotes(place(g0, ["nulli", a], ["noncade", c]), { p1: b, p2: a, p3: a, p4: a }).lastResult!;
    expect(r.counts).toEqual({ [b]: 1 }); expect(r.fallenPositions).toEqual([b]);
    expect(r.marks![0]).toMatchObject({ effect: "nulli", hit: true, caught: ["p2", "p3", "p4"] });
    expect(r.points.p2).toBe(0); expect(r.points.p3).toBe(2);   // p3: la sua carta b è caduta
  });

  it("pareggio senza la carta del CADE: cadono tutte le pari (il voto del Megafono non decide)", () => {
    const g0 = C(4), { m, a, b, c } = pos(g0);
    const r = castVotes(place(g0, ["cade", c], ["noncade", m]), { p1: a, p2: a, p3: b, p4: b }).lastResult!;
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([a, b].sort((x, y) => x - y)); expect(r.tieBreak).toBe(false);
  });

  it("con 3 giocatori valgono le stesse regole (3 carte, 2 segnalini)", () => {
    const g0 = C(3); expect(g0.tower).toHaveLength(3);
    const [x, y, z] = g0.tower.map((t) => t.position) as [number, number, number];
    const r = castVotes(place(g0, ["cade", x], ["nulli", y]), { p1: z, p2: x, p3: y }).lastResult!;
    expect(r.fallenPositions).toEqual([x, z].sort((p, q) => p - q).includes(x) ? r.fallenPositions : []);
    expect(r.tie).toBe(true); expect(r.fallenPositions).toEqual([x]);   // x 1, z 1 (y annullata): vince il CADE
  });

  it("i bot giocano il gioco base fino in fondo, da 3 a 8 giocatori, senza azioni illegali", () => {
    for (const n of [3, 4, 6, 8]) for (const level of ["easy", "medium", "hard"] as const) {
      let s = createGame({ ...cfg(n, { seed: 21 + n, cnc: true, miniGame: false }), luiSlots: undefined }).state;
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
