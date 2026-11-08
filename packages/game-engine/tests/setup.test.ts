import { describe, expect, it } from "vitest";
import { createGame, EngineError, roundsFor, miniAtsFor, megafonoOf } from "../src/index.ts";
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
  it("turni: 6 in 3 giocatori (2 giri), altrimenti tanti turni quanti i giocatori (1 giro)", () => {
    expect([3, 4, 5, 6, 7, 8].map(roundsFor)).toEqual([2, 1, 1, 1, 1, 1]);
    expect([3, 4, 5, 6, 7, 8].map((n) => start(n).totalTurns)).toEqual([6, 4, 5, 6, 7, 8]);
  });
  it("intervalli: 1 fino a 5 giocatori (a metà), 2 da 6 a 8 (a un terzo e a due terzi)", () => {
    expect([3, 4, 5, 6, 7, 8].map(miniAtsFor)).toEqual([[3], [2], [2], [2, 4], [2, 4], [2, 5]]);
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
