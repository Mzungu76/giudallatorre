import { describe, expect, it } from "vitest";
import { applyAction, checkInvariants, miniAtsFor, simulateGame, suggestAction, viewFor } from "../src/index.ts";
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
  it("il primo intervallo parte al turno previsto (a metà fino a 5 giocatori, a un terzo da 6 a 8), rinnova tutte le mani e non c'è il Megafono", () => {
    for (const [n, mid] of [[3, 3], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]] as const) {
      const before = start(n, { miniGame: "amore" });
      expect(before.miniAt).toBe(mid);
      const s = toMini(n, "amore");
      expect(s.turnNumber).toBe(mid);
      for (const p of s.playerIds) expect(s.hands[p]!.length).toBe(5);
      const v = viewFor(s, "p1");
      expect(v.mini?.kind).toBe("amore"); expect(v.mini?.cardId).toBeTruthy();
    }
  });
  it("all'inizio dell'intervallo le mani sono davvero nuove (nessuna carta di prima) e la vista lo segnala", () => {
    let s = start(4, { miniGame: "accusa", accuseDeck: ["x"] }), r = 3; const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const seen = new Set<string>(); let prevHands: string[] = [];
    expect(viewFor(s, "p1").handRenewals).toBe(0);
    while (s.phase !== "MINI_PLAY") {
      if (s.phase === "RESULTS") { prevHands = Object.values(s.hands).flat(); s = act(s, { type: "advance" }); continue; }
      for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
    }
    for (const c of prevHands) seen.add(c);
    for (const p of s.playerIds) expect(s.hands[p]).toHaveLength(5);
    for (const c of Object.values(s.hands).flat()) expect(seen.has(c)).toBe(false);
    expect(viewFor(s, "p1").handRenewals).toBe(1);
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
    expect(g.scores.p1! - before.p1!).toBe(4);            // 3 (voto) + 6 (proprietario ×2) = 9, tagliato al tetto di 4 (4 giocatori, 2 turni rimasti)
    expect(g.scores.p4! - before.p4!).toBe(0);            // votava una carta caduta e la sua è caduta
  });
  it("pareggio in testa: restano tutte e fanno punti; le carte con meno voti cadono", () => {
    let g = playAll(toMini(4, "accusa"));
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2"), c = posOfOwner(g, "p3");
    g = vote(g, { p1: a, p2: b, p3: a, p4: b });
    const r = g.miniResult!;
    expect(r.leaders.sort()).toEqual([a, b].sort()); expect(r.fallenPositions).toContain(c);
    expect(r.points.p1).toBe(4); expect(r.points.p2).toBe(4); expect(r.points.p3).toBe(2); expect(r.points.p4).toBe(2);   // 2 voti + 4 (×2) = 6, tagliato al tetto di 4
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
  it("Il peggiore: cade la carta più votata; ognuno prende tanti punti quanti sono i voti ricevuti dalla carta che ha giocato; chi vota non prende nulla", () => {
    let g = playAll(toMini(4, "peggiore"));
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2");
    g = vote(g, { p1: b, p2: a, p3: a, p4: a });
    const r = g.miniResult!;
    expect(r.fallenPositions).toEqual([a]); expect(g.mini?.cardId).toBeNull();
    expect(r.points).toEqual({ p1: 3, p2: 1, p3: 0, p4: 0 });   // 3 voti sulla carta di p1, 1 su quella di p2
    expect(r.lines.p1).toEqual([{ kind: "mini-peggiore", pts: 3, pos: a }]);
  });
  it("Il peggiore: a pari merito cadono tutte le carte in testa e ognuno prende i propri voti", () => {
    let g = playAll(toMini(4, "peggiore"));
    const a = posOfOwner(g, "p1"), b = posOfOwner(g, "p2");
    g = vote(g, { p1: b, p2: a, p3: a, p4: b });
    expect(g.miniResult!.fallenPositions.sort()).toEqual([a, b].sort());
    expect(g.miniResult!.points).toEqual({ p1: 2, p2: 2, p3: 0, p4: 0 });
  });
  it("Il peggiore: la propria carta non si può votare (e il massimo di una carta è N−1 voti)", () => {
    let g = playAll(toMini(4, "peggiore"));
    const own = posOfOwner(g, "p1"), other = posOfOwner(g, "p2");
    expect(() => applyAction(g, { type: "vote", playerId: "p1", position: own })).toThrow(/INVALID_CHOICE/);
    expect(viewFor(g, "p1").myPosition).toBe(own); expect(viewFor(g, "p2").myPosition).toBe(other);   // ognuno sa solo la propria
    g = vote(g, { p1: other, p2: posOfOwner(g, "p1"), p3: other, p4: other });
    expect(g.miniResult!.points.p2).toBe(3);
    expect(Math.max(...Object.values(g.miniResult!.points))).toBeLessThanOrEqual(3);
  });
  it("Il peggiore: i giocatori inattivi e i bot non votano mai la propria carta", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let g = playAll(toMini(5, "peggiore")), r = seed;
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      for (const p of g.playerIds) { const a = suggestAction(g, p, rand)!; expect(a.type === "vote" && a.position !== posOfOwner(g, p)).toBe(true); g = act(g, a); }
      expect(g.phase).toBe("MINI_RESULTS");
    }
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
    expect(g.phase).toBe("PROCLAIM"); expect(g.turnNumber).toBe(3); expect(g.mini).toBeNull(); expect(g.miniDone).toBe(true);
    for (const p of g.playerIds) expect(g.hands[p]!.length).toBe(5);
    expect(checkInvariants(g, deck)).toEqual([]);
  });
  it("partite complete con ogni mini-gioco: invarianti, un intervallo fino a 5 giocatori e due da 6 a 8, nessun errore", () => {
    for (const kind of ["accusa", "amore", "peggiore", "random"] as const) for (const n of [3, 5, 6, 8]) {
      const { state, problems, log } = simulateGame(cfg(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"], seed: 11 + n }), 5, { checkEveryStep: true });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
      expect(log.flatMap((l) => l.events).filter((e) => e.type === "miniStarted")).toHaveLength(n <= 5 ? 1 : 2);
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

describe("numero di intervalli", () => {
  it("1 fino a 5 giocatori, 2 da 6 a 8 (mini-giochi diversi tra loro), ai turni previsti", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      let s = start(n, { miniGame: "random", accuseDeck: ["Mi ha rubato il panino!"] }), g = 0, r = n * 13 + 1; const at: number[] = [];
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      while (s.phase !== "GAME_OVER" && g++ < 5000) {
        if (s.phase === "MINI_PLAY" && !at.includes(s.turnNumber)) at.push(s.turnNumber);
        if (s.phase === "RESULTS" || s.phase === "MINI_RESULTS") { s = act(s, { type: "advance" }); continue; }
        for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
      }
      expect(s.phase, `${n} giocatori`).toBe("GAME_OVER");
      expect(at, `${n} giocatori`).toEqual(miniAtsFor(n));
      expect(s.minisDone).toBe(n <= 5 ? 1 : 2);
      expect(new Set(s.miniKinds).size).toBe(s.miniKinds!.length);   // mai lo stesso mini-gioco due volte
    }
  });
});
