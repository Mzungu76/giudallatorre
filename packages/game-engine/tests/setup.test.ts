import { describe, expect, it } from "vitest";
import { createGame, EngineError, roundsFor, megafonoOf } from "../src/index.ts";
import { cfg, makeDeck, start } from "./helpers.ts";

describe("preparazione della partita", () => {
  it.each([3, 4, 5, 6, 7, 8])("con %i giocatori: 5 carte a testa, mazzo consistente, fase PROCLAIM", (n) => {
    const s = start(n);
    expect(s.phase).toBe("PROCLAIM");
    for (const p of s.playerIds) expect(s.hands[p]).toHaveLength(5);
    expect(s.drawPile).toHaveLength(125 - 5 * n);
    expect(new Set([...s.drawPile, ...Object.values(s.hands).flat()]).size).toBe(125);
    expect(s.turnNumber).toBe(1);
    expect(s.proclaim).not.toBeNull();
  });
  it("rifiuta meno di 3 e più di 8 giocatori", () => {
    expect(() => createGame(cfg(2))).toThrow(EngineError);
    expect(() => createGame(cfg(9))).toThrow(/INVALID_PLAYERS/);
  });
  it("rifiuta id duplicati, mazzo troppo piccolo o con carte duplicate", () => {
    const c = cfg(3); c.players[1]!.id = "p1";
    expect(() => createGame(c)).toThrow(/INVALID_PLAYERS/);
    expect(() => createGame(cfg(8, { deck: makeDeck(40) }))).toThrow(/INVALID_DECK/);
    expect(() => createGame(cfg(3, { deck: ["a", "a", ...makeDeck(40)] }))).toThrow(/INVALID_DECK/);
  });
  it("giri di Megafono: 2 a testa fino a 5 giocatori, 1 a 6–8", () => {
    expect([3, 4, 5].map(roundsFor)).toEqual([2, 2, 2]);
    expect([6, 7, 8].map(roundsFor)).toEqual([1, 1, 1]);
    expect(start(3).totalTurns).toBe(6); expect(start(5).totalTurns).toBe(10);
    expect(start(6).totalTurns).toBe(6); expect(start(8).totalTurns).toBe(8);
  });
  it("è deterministico a parità di seed e diverso con seed diversi", () => {
    const a = start(5), b = start(5), c = start(5, { seed: 7 });
    expect(a).toEqual(b); expect(a.hands).not.toEqual(c.hands);
  });
  it("il primo Megafono è casuale ma riproducibile se non indicato", () => {
    const a = createGame(cfg(6, { firstMegafonoIndex: undefined, seed: 3 })).state;
    const b = createGame(cfg(6, { firstMegafonoIndex: undefined, seed: 3 })).state;
    expect(megafonoOf(a)).toBe(megafonoOf(b));
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) seen.add(megafonoOf(createGame(cfg(6, { firstMegafonoIndex: undefined, seed })).state));
    expect(seen.size).toBeGreaterThan(3);
  });
});
