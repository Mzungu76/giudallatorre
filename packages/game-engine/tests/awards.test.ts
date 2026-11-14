import { describe, expect, it } from "vitest";
import { awardCandidates, pickAward, AWARD_IDS, simulateGame, viewFor } from "../src/index.ts";
import type { PlayerId, TurnRecord } from "../src/index.ts";
import { cfg } from "./helpers.ts";

const P = ["a", "b", "c", "d"] as const;
/** Un turno a 4: la carta in posizione i+1 è di P[i]; `votes` dice per ciascuno la posizione votata. */
const turn = (n: number, mega: PlayerId, votes: number[], fallen: number[], mark: TurnRecord["mark"] = null): TurnRecord => ({
  turn: n, megafonoId: mega, votes: Object.fromEntries(P.map((p, i) => [p, votes[i]!])), owners: { 1: "a", 2: "b", 3: "c", 4: "d" }, fallen, megaVote: 1, mark,
});
const input = (history: TurnRecord[], extra = {}) => ({ playerIds: [...P], scores: { a: 10, b: 8, c: 6, d: 4 }, history, ...extra });
const ids = (h: TurnRecord[], extra = {}) => awardCandidates(input(h, extra)).map((c) => c.id);

describe("premio della serata: soglie", () => {
  it("il Segugio: chi ha votato la carta caduta quasi sempre", () => {
    // a vota sempre la carta che cade (posizione 2); gli altri votano a caso fuori
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [2, 1, 1, 1], [2]));
    const c = awardCandidates(input(h)).find((x) => x.id === "segugio")!;
    expect(c.winners).toEqual(["a"]); expect(c.n).toBe(4); expect(c.of).toBe(4);
  });
  it("il Pollo: vota dove il Megafono ha posato il segnalino; il Megafono non conta", () => {
    const mk = { position: 1, effect: "cade" as const, hit: true };
    const h = [turn(1, "a", [1, 1, 1, 1], [1], mk), turn(2, "b", [1, 2, 3, 1], [3], mk), turn(3, "c", [1, 1, 1, 4], [4], mk), turn(4, "d", [4, 3, 2, 1], [2], mk)];
    const c = awardCandidates(input(h)).find((x) => x.id === "pollo")!;
    // d: turni 1,2,3 dove era Folla → ha votato 1,1,4 → 2 su 3; b: turni 1,3,4 → 1,1,3 → 2 su 3; c: turni 1,2,4 → 1,3,2 → 1; a: 2,3,4 → 1,1,4 → 2 su 3
    expect(c.n).toBe(2); expect(c.of).toBe(3); expect(c.winners.sort()).toEqual(["a", "b", "d"]);
  });
  it("il Bugiardo di Stato: le sue carte non prendono voti degli altri", () => {
    // nessuno vota mai la carta 4 (di d); gli altri 3 la ricevono spesso
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [3, 3, 2, 1], [1]));
    const c = awardCandidates(input(h)).find((x) => x.id === "bugiardo")!;
    expect(c.winners).toEqual(["d"]); expect(c.n).toBe(0); expect(c.of).toBe(4);
  });
  it("il Narciso: vota la propria carta; senza soglia raggiunta non c'è", () => {
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [1, 3, 1, 4], [2]));
    expect(awardCandidates(input(h)).find((x) => x.id === "narciso")!.winners.sort()).toEqual(["a", "d"]);
    expect(ids([turn(1, "a", [2, 3, 4, 1], [2])])).toEqual([]);
  });
  it("il Veggente e il Visionario Bocciato esistono solo se il risultato non è uguale per tutti", () => {
    const hit = (b: boolean) => ({ position: 1, effect: "cade" as const, hit: b });
    const h1 = [turn(1, "a", [1, 2, 3, 4], [1], hit(true)), turn(2, "b", [1, 2, 3, 4], [1], hit(false)), turn(3, "c", [1, 2, 3, 4], [1], hit(false)), turn(4, "d", [1, 2, 3, 4], [1], hit(false))];
    expect(awardCandidates(input(h1)).find((x) => x.id === "veggente")!.winners).toEqual(["a"]);
    expect(awardCandidates(input(h1)).find((x) => x.id === "bocciato")!.winners.sort()).toEqual(["b", "c", "d"]);
    const h2 = h1.map((t) => ({ ...t, mark: hit(true) }));
    expect(ids(h2)).not.toContain("veggente");
  });
  it("i giocatori virtuali non vincono (se ci sono giocatori veri)", () => {
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [2, 1, 1, 1], [2]));
    expect(awardCandidates(input(h, { botIds: ["a"] })).find((x) => x.id === "segugio")).toBeUndefined();
    expect(awardCandidates(input(h, { botIds: ["a", "b", "c", "d"] })).find((x) => x.id === "segugio")!.winners).toEqual(["a"]); // solo bot: tutti eleggibili
  });
});

describe("premio della serata: sorteggio", () => {
  it("senza soglie raggiunte va il premio di consolazione a chi ha meno punti", () => {
    const a = pickAward(input([turn(1, "a", [2, 3, 4, 1], [2])]), { rng: 7 })!;
    expect(a).toEqual({ id: "tabellone", winnerId: "d", n: 4, of: 0, consolation: true });
  });
  it("è deterministico a parità di stato, e usa solo premi con soglia raggiunta", () => {
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [1, 1, 2, 4], [1]));
    const x = pickAward(input(h), { rng: 99 }), y = pickAward(input(h), { rng: 99 });
    expect(x).toEqual(y); expect(ids(h)).toContain(x!.id);
  });
  it("tra più premi possibili, con semi diversi escono premi diversi (pesi, non sempre lo stesso)", () => {
    const h = [1, 2, 3, 4].map((n) => turn(n, P[n - 1]!, [1, 1, 2, 4], [1]));
    expect(ids(h).length).toBeGreaterThan(1);
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickAward(input(h), { rng: i * 7919 })!.id));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("premio della serata: dentro la partita", () => {
  it("a fine partita il motore assegna un premio a un giocatore vero, visibile a tutti solo a partita finita", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const n = 4, { state } = simulateGame(cfg(n, { seed, botIds: ["p4"] }), seed * 13);
      expect(state.history!.length).toBeGreaterThanOrEqual(n);
      expect(state.award, `seed ${seed}`).toBeTruthy();
      expect(AWARD_IDS).toContain(state.award!.id);
      expect(state.award!.winnerId).not.toBe("p4");
      for (const p of state.playerIds) expect(viewFor(state, p).award).toEqual(state.award);
    }
  });
  it("prima della fine non c'è premio nella vista", () => {
    const { state } = simulateGame(cfg(4, { seed: 5 }), 3);
    const mid = { ...state, phase: "RESULTS" as const };
    expect(viewFor(mid, "p1").award).toBeNull();
  });
});
