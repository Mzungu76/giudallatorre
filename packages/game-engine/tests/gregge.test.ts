import { describe, expect, it } from "vitest";
import { act, castVotes, cfg, posOf, start, toSuspect } from "./helpers.ts";
import { chooseBotAction, createGame, luiTokens, newBotMemory, viewFor } from "../src/index.ts";
import type { GameState, LuiSlot } from "../src/index.ts";

/** Variante «Il gregge»: lo 0 è una trappola (0 punti nel turno a chi vota la sua carta, che cada o no); le soglie restano come sempre. */
function setup(n: number, slot: LuiSlot, at: (g: GameState) => number) {
  const g = toSuspect(start(n, { gregge: true }));
  return act(g, { type: "placeLui", playerId: "p1", slot, position: at(g) });
}

describe("variante «Il gregge»", () => {
  it("2 segnalini: sempre lo 0 (trappola, nessun punto stampato) più una soglia a caso, come nella partita normale", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame({ ...cfg(5, { seed, gregge: true }), luiSlots: undefined }).state, set = luiTokens(g);
      expect(set).toHaveLength(2);
      expect(set.find((x) => x.slot === "zero")).toEqual({ slot: "zero", k: 0, pts: 0, trap: true });
      expect(set.find((x) => x.slot !== "zero")!.trap).toBeUndefined();
      expect(viewFor(g, "p2").gregge).toBe(true);
    }
    expect(viewFor(start(4), "p2").gregge).toBe(false);
    expect(luiTokens(start(4)).some((x) => x.trap)).toBe(false);
  });

  it("lo 0 sulla carta che cade: chi l'ha votata fa 0 punti nel turno (anche il +2 della carta), gli altri prendono i loro punti, il Megafono non incassa nulla", () => {
    const g = setup(4, "zero", (s) => posOf(s, "p2"));
    const x = posOf(g, "p2"), y = posOf(g, "p3");
    const r = castVotes(g, { p1: y, p2: x, p3: x, p4: x }).lastResult!;
    expect(r.fallenPositions).toEqual([x]);
    expect(r.points).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });          // p2 aveva voto giusto +2 e carta caduta +2: tutto azzerato
    expect(r.lines.p2!.map((l) => l.kind)).toEqual(["voto", "carta", "gregge"]);
    expect(r.lines.p2!.reduce((a, l) => a + l.pts, 0)).toBe(0);
    expect(r.lines.p1).toEqual([]);                                     // il Megafono non prende nulla dal gettone
    expect(r.lui).toMatchObject({ slot: "zero", trap: true, hit: true, caught: ["p2", "p3", "p4"], others: 3 });
  });

  it("lo 0 sulla carta che resta su: chi l'ha votata fa 0 anche se la sua carta è caduta", () => {
    const g = setup(4, "zero", (s) => posOf(s, "p3"));
    const x = posOf(g, "p3"), f = posOf(g, "p2");
    const r = castVotes(g, { p1: f, p2: x, p3: f, p4: f }).lastResult!;
    expect(r.fallenPositions).toEqual([f]);
    expect(r.points.p2).toBe(0);                                        // la sua carta è caduta (+2) ma ha votato la trappola
    expect(r.points.p1).toBe(2); expect(r.points.p3).toBe(2); expect(r.points.p4).toBe(2);
    expect(r.lui).toMatchObject({ hit: true, caught: ["p2"] });
  });

  it("il Megafono che vota la propria trappola fa 0 anche lui; nessuno ci casca = nessun effetto", () => {
    let g = setup(4, "zero", (s) => posOf(s, "p2"));
    const x = posOf(g, "p2"), y = posOf(g, "p3");
    let r = castVotes(g, { p1: x, p2: y, p3: y, p4: y }).lastResult!;
    expect(r.points.p1).toBe(0); expect(r.lui!.caught).toEqual(["p1"]);
    g = setup(4, "zero", (s) => posOf(s, "p2"));
    r = castVotes(g, { p1: y, p2: y, p3: y, p4: y }).lastResult!;
    expect(r.lui).toMatchObject({ hit: false, caught: [] });
    expect(r.points).toEqual({ p1: 2, p2: 2, p3: 4, p4: 2 });
  });

  it("le soglie funzionano come sempre: il Megafono incassa se la carta ha almeno k voti degli altri, che cada o no", () => {
    const g = setup(4, "k2", (s) => posOf(s, "p2"));
    const x = posOf(g, "p2"), f = posOf(g, "p3");
    const r = castVotes(g, { p1: f, p2: x, p3: f, p4: x }).lastResult!;
    expect(r.lui).toMatchObject({ slot: "k2", hit: true, others: 2 });
    expect(r.lines.p1!.map((l) => l.kind)).toContain("lui");
    expect(r.points.p2).toBe(0); expect(r.points.p4).toBe(0);           // nessuna trappola: semplicemente non hanno indovinato
  });

  it("i bot giocano la variante fino in fondo senza errori", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      let s = createGame({ ...cfg(5, { seed: 7, gregge: true, miniGame: false }), luiSlots: undefined }).state;
      const mem = newBotMemory(); let seed = 1;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 2000 && s.phase !== "GAME_OVER"; i++) {
        if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
        const a = s.playerIds.map((p) => chooseBotAction(s, p, level, mem, rand)).find((x) => x);
        s = act(s, a!);
      }
      expect(s.phase).toBe("GAME_OVER");
    }
  });
});
