import { describe, expect, it } from "vitest";
import { applyAction, checkInvariants, simulateGame, suggestAction, viewFor } from "../src/index.ts";
import type { GameState, MiniKind } from "../src/index.ts";
import { act, cfg, makeDeck, start } from "./helpers.ts";

/** Gioca (con azioni a caso) fino all'inizio del mini-gioco. */
function toMini(n: number, kind: MiniKind, extra = {}): GameState {
  let s = start(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"], ...extra }), g = 0, r = 7;
  const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (s.phase !== "MINI_PLAY" && g++ < 3000) {
    if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
    for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
  }
  expect(s.phase).toBe("MINI_PLAY");
  return s;
}
const playAll = (s: GameState) => { let g = s; for (const p of g.playerIds) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! }); return g; };
const vote = (s: GameState, v: Record<string, number>) => { let g = s; for (const p of g.playerIds) g = act(g, { type: "vote", playerId: p, position: v[p]! }); return g; };
const posOfOwner = (g: GameState, o: string) => g.tower.find((t) => t.ownerId === o)!.position;

describe("mini-gioco di metà partita", () => {
  it("parte dopo metà dei turni (arrotondata per difetto), rinnova tutte le mani e non c'è il Megafono", () => {
    for (const [n, mid] of [[3, 3], [4, 4], [5, 5], [6, 3], [7, 3], [8, 4]] as const) {
      const before = start(n, { miniGame: "amore" });
      expect(before.miniAt).toBe(mid);
      const s = toMini(n, "amore");
      expect(s.turnNumber).toBe(mid);
      for (const p of s.playerIds) expect(s.hands[p]!.length).toBe(5);
      const v = viewFor(s, "p1");
      expect(v.mini?.kind).toBe("amore"); expect(v.mini?.cardId).toBeTruthy();
    }
  });
  it("le mani sono davvero nuove (nessuna carta di prima)", () => {
    const g0 = start(4, { miniGame: "accusa", accuseDeck: ["x"] });
    let s = g0, r = 3; const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const seen = new Set<string>(); let prevHands: string[] = [];
    while (s.phase !== "MINI_PLAY") {
      if (s.phase === "RESULTS") { prevHands = Object.values(s.hands).flat(); s = act(s, { type: "advance" }); continue; }
      for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
    }
    for (const c of prevHands) seen.add(c);
    for (const c of Object.values(s.hands).flat()) expect(seen.has(c)).toBe(false);
  });
  it("Storia d'amore: votanti della carta in testa prendono i voti ricevuti (anche il proprio), chi l'ha giocata il doppio, le altre cadono", () => {
    let g = playAll(toMini(4, "amore"));
    expect(g.phase).toBe("MINI_VOTE");
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2"), c = posOfOwner(g, "p3");
    // 3 voti su a (p2, p3, p1 stesso), 1 su b
    const before = { ...g.scores };
    g = vote(g, { p1: a, p2: a, p3: a, p4: b });
    expect(g.phase).toBe("MINI_RESULTS");
    const r = g.miniResult!;
    expect(r.leaders).toEqual([a]); expect(r.fallenPositions.sort()).toEqual([b, c, posOfOwner(g, "p4")].sort());
    expect(g.scores.p2! - before.p2!).toBe(3); expect(g.scores.p3! - before.p3!).toBe(3);
    expect(g.scores.p1! - before.p1!).toBe(8);            // 3 (voto) + 6 (proprietario ×2) = 9, tagliato al tetto di 8 (4 giocatori, 4 turni rimasti)
    expect(g.scores.p4! - before.p4!).toBe(0);            // votava una carta caduta e la sua è caduta
  });
  it("pareggio in testa: restano tutte e fanno punti; le carte con meno voti cadono", () => {
    let g = playAll(toMini(4, "accusa"));
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2"), c = posOfOwner(g, "p3");
    g = vote(g, { p1: a, p2: b, p3: a, p4: b });
    const r = g.miniResult!;
    expect(r.leaders.sort()).toEqual([a, b].sort()); expect(r.fallenPositions).toContain(c);
    expect(r.points.p1).toBe(2 + 4); expect(r.points.p2).toBe(2 + 4); expect(r.points.p3).toBe(2); expect(r.points.p4).toBe(2);
  });
  it("se tutte le carte hanno gli stessi voti non cade nessuna", () => {
    let g = playAll(toMini(3, "amore"));
    const [a, b, c] = ["p1", "p2", "p3"].map((o) => posOfOwner(g, o)) as [number, number, number];
    g = vote(g, { p1: b, p2: c, p3: a });
    expect(g.miniResult!.fallenPositions).toEqual([]); expect(g.miniResult!.leaders).toHaveLength(3);
  });
  it("il tetto ai punti si autoregola: un giocatore non guadagna più di max(N, 2×turni rimasti)", () => {
    let g = playAll(toMini(6, "amore"));
    const a = posOfOwner(g, "p1");
    g = vote(g, Object.fromEntries(g.playerIds.map((p) => [p, a])));
    const r = g.miniResult!;
    expect(r.cap).toBe(Math.max(6, 2 * (g.totalTurns - g.miniAt!)));
    for (const p of g.playerIds) expect(r.points[p]).toBeLessThanOrEqual(r.cap);
    expect(r.points.p1).toBe(r.cap);                        // 6 voti + 12 → tagliato al tetto
    expect(r.lines.p1!.some((l) => l.kind === "mini-tetto")).toBe(true);
  });
  it("Raccomandato: cade la carta più votata e chi l'ha giocata perde i voti ricevuti (mai sotto zero); i votanti non prendono nulla", () => {
    let g = playAll(toMini(4, "raccomandato"));
    g = { ...g, scores: { p1: 5, p2: 1, p3: 0, p4: 4 } };
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2");
    g = vote(g, { p1: b, p2: a, p3: a, p4: a });
    const r = g.miniResult!;
    expect(r.fallenPositions).toEqual([a]); expect(g.mini?.cardId).toBeNull();
    expect(g.scores.p1).toBe(2); expect(g.scores.p2).toBe(1); expect(g.scores.p3).toBe(0); expect(g.scores.p4).toBe(4);
  });
  it("Raccomandato: a pari merito cadono tutte; il punteggio non scende sotto zero", () => {
    let g = playAll(toMini(4, "raccomandato"));
    g = { ...g, scores: { p1: 0, p2: 1, p3: 9, p4: 9 } };
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2");
    g = vote(g, { p1: a, p2: b, p3: a, p4: b });
    expect(g.miniResult!.fallenPositions.sort()).toEqual([a, b].sort());
    expect(g.scores.p1).toBe(0); expect(g.scores.p2).toBe(0);
  });
  it("si può votare la propria carta", () => {
    let g = playAll(toMini(3, "accusa"));
    expect(() => { for (const p of g.playerIds) g = applyAction(g, { type: "vote", playerId: p, position: posOfOwner(g, p) }).state; }).not.toThrow();
    expect(g.phase).toBe("MINI_RESULTS");
  });
  it("dopo il mini-gioco si riprende: carte conservate, mani da 5, turno successivo e il mini-gioco non si ripete", () => {
    let g = playAll(toMini(4, "amore")); const deck = makeDeck(125);
    const a = posOfOwner(g, "p1"); g = vote(g, Object.fromEntries(g.playerIds.map((p) => [p, a])));
    g = act(g, { type: "advance" });
    expect(g.phase).toBe("PROCLAIM"); expect(g.turnNumber).toBe(5); expect(g.mini).toBeNull(); expect(g.miniDone).toBe(true);
    for (const p of g.playerIds) expect(g.hands[p]!.length).toBe(5);
    expect(checkInvariants(g, deck)).toEqual([]);
  });
  it("partite complete con ogni mini-gioco: invarianti, una sola volta, nessun errore", () => {
    for (const kind of ["accusa", "amore", "raccomandato", "random"] as const) for (const n of [3, 5, 6, 8]) {
      const { state, problems, log } = simulateGame(cfg(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"], seed: 11 + n }), 5, { checkEveryStep: true });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
      expect(log.flatMap((l) => l.events).filter((e) => e.type === "miniStarted")).toHaveLength(1);
    }
  });
  it("senza miniGame non cambia nulla", () => {
    const { log } = simulateGame(cfg(4), 5);
    expect(log.flatMap((l) => l.events).some((e) => e.type === "miniStarted")).toBe(false);
  });
  it("la vista non svela i proprietari prima dei risultati", () => {
    const g = playAll(toMini(4, "amore"));
    expect(viewFor(g, "p2").tower.every((t) => t.ownerId === null)).toBe(true);
    const r = vote(g, Object.fromEntries(g.playerIds.map((p) => [p, 1])));
    expect(viewFor(r, "p2").miniResult).not.toBeNull(); expect(viewFor(r, "p2").tower.some((t) => t.ownerId !== null)).toBe(true);
  });
});
