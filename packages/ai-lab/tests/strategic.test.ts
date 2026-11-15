import { describe, expect, it } from "vitest";
import { parseSpec, runTournament } from "../src/index.ts";
import { content } from "./fixtures.ts";

describe("il bot strategico nel laboratorio", () => {
  const cfg = { games: 6, players: 4, seed: 21, participants: ["strategic-pts-0.1:hard", "production:hard", "strategic-win-0.1:hard", "production:medium"].map(parseSpec) };
  it("gioca partite complete senza azioni illegali ed è ripetibile da seme", () => {
    const a = runTournament(cfg, content), b = runTournament(cfg, content);
    for (const g of a.games) expect(g.problems).toEqual([]);
    expect(b.resultsHash).toBe(a.resultsHash);
  });
  it("con un tavolo da 3 a 8 giocatori non si blocca", () => {
    for (const n of [3, 5, 8]) {
      const r = runTournament({ games: 2, players: n, seed: n, participants: Array.from({ length: n }, (_, i) => parseSpec(i % 2 ? "production:hard" : "strategic-pts-0.1:hard")) }, content);
      for (const g of r.games) expect(g.problems).toEqual([]);
    }
  });
});
