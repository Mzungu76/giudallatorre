import { describe, expect, it } from "vitest";
import { applyAction, checkInvariants, EngineError, MINI_CARDS, MINI_CYCLES, miniAtsFor, simulateGame, suggestAction, viewFor } from "../src/index.ts";
import type { GameState, MiniKind } from "../src/index.ts";
import { act, cfg, makeDeck, start } from "./helpers.ts";

/** Gioca (con azioni a caso) fino all'inizio dell'intervallo a tempo. */
function toMini(n: number, kind: MiniKind, extra = {}): GameState {
  let s = start(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"], ...extra }), g = 0, r = 7;
  const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  while (s.phase !== "MINI_RUN" && g++ < 3000) {
    if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
    for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = act(s, a); break; } }
  }
  expect(s.phase).toBe("MINI_RUN");
  return s;
}
/** Voti nell'ordine dato: `v` è una lista [giocatore, posizione]; chi non c'è non vota. */
const voteList = (s: GameState, v: [string, number][]) => { let g = s; for (const [p, pos] of v) g = act(g, { type: "vote", playerId: p, position: pos }); return g; };
const ended = (s: GameState) => (s.phase === "MINI_RUN" ? act(s, { type: "endRun" }) : s);

describe("intervallo a tempo: avvio", () => {
  it("parte al turno previsto, senza Megafono; le mani non si toccano; 6 personaggi dal mazzo, di nessuno", () => {
    for (const [n, mid] of [[3, 3], [4, 2], [5, 2], [6, 2]] as const) {
      expect(start(n, { miniGame: "amore" }).miniAt).toBe(mid);
      const s = toMini(n, "amore");
      expect(s.turnNumber).toBe(mid);
      for (const p of s.playerIds) expect(s.hands[p]!.length).toBe(5);
      expect(s.tower).toHaveLength(MINI_CARDS);
      expect(s.tower.map((t) => t.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(s.tower.every((t) => t.ownerId === null)).toBe(true);
      expect(new Set(s.tower.map((t) => t.cardId)).size).toBe(MINI_CARDS);
      const v = viewFor(s, "p1");
      expect(v.mini?.kind).toBe("amore"); expect(v.mini?.cardId).toBeTruthy();
    }
  });
  it("durante la corsa le mani non cambiano e l'accusatore / il partner non è tra i 6", () => {
    const s = toMini(4, "accusa"); const hands = JSON.stringify(s.hands);
    expect(JSON.stringify(s.hands)).toBe(hands);
    expect(s.tower.map((t) => t.cardId)).not.toContain(s.mini!.cardId);
    expect(s.mini!.text).toBe("Mi ha rubato il panino!");
    expect(toMini(4, "peggiore").mini!.cardId).toBeNull();
  });
  it("ordine di uscita: tre giri completi, ognuno con tutte le carte una volta, senza ripetere subito la stessa", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = toMini(4, "peggiore", { seed }), o = s.mini!.order;
      expect(o).toHaveLength(MINI_CARDS * MINI_CYCLES);
      for (let c = 0; c < MINI_CYCLES; c++) expect(o.slice(c * MINI_CARDS, (c + 1) * MINI_CARDS).slice().sort()).toEqual([1, 2, 3, 4, 5, 6]);
      for (let i = 1; i < o.length; i++) expect(o[i]).not.toBe(o[i - 1]);
      expect(viewFor(s, "p2").mini!.order).toEqual(o);
    }
  });
});

describe("intervallo a tempo: punti uniformi", () => {
  it("Accusa: +2 a chi vota la carta in testa (che cade), +4 al primo di loro; gli altri niente", () => {
    const s = toMini(4, "accusa");
    const r = ended(voteList(s, [["p3", 2], ["p1", 5], ["p2", 2], ["p4", 2]])).miniResult!;
    expect(r.counts[2]).toBe(3); expect(r.leaders).toEqual([2]); expect(r.fallenPositions).toEqual([2]); expect(r.fastest).toBe("p3");
    expect(r.points).toEqual({ p1: 0, p2: 2, p3: 6, p4: 2 });
    expect(r.lines.p3).toEqual([{ kind: "mini-giusto", pts: 2, pos: 2 }, { kind: "mini-veloce", pts: 4, pos: 2 }]);
  });
  it("il più veloce è tra i vincitori: chi ha votato prima ma una carta che non vince non conta", () => {
    const s = toMini(4, "peggiore");
    const r = voteList(s, [["p1", 6], ["p2", 3], ["p3", 3], ["p4", 3]]).miniResult!;   // tutti votano → si risolve da sola
    expect(r.fastest).toBe("p2"); expect(r.points).toEqual({ p1: 0, p2: 6, p3: 2, p4: 2 }); expect(r.fallenPositions).toEqual([3]);
  });
  it("parità: cadono tutte le carte in testa e tutti i loro votanti prendono +2 (il +4 va al primo in assoluto)", () => {
    const s = toMini(4, "accusa");
    const r = voteList(s, [["p4", 4], ["p1", 1], ["p2", 1], ["p3", 4]]).miniResult!;
    expect(r.leaders.sort()).toEqual([1, 4]); expect(r.fallenPositions.sort()).toEqual([1, 4]); expect(r.fastest).toBe("p4");
    expect(r.points).toEqual({ p1: 2, p2: 2, p3: 2, p4: 6 });
  });
  it("Storia d'amore: le carte in testa vincono e restano (non cade nessuna); stessi punti", () => {
    const s = toMini(4, "amore");
    const r = voteList(s, [["p2", 5], ["p1", 5], ["p3", 1], ["p4", 5]]).miniResult!;
    expect(r.leaders).toEqual([5]); expect(r.fallenPositions).toEqual([]); expect(r.fallenCardIds).toEqual([]);
    expect(r.points).toEqual({ p1: 2, p2: 6, p3: 0, p4: 2 });
  });
  it("chi non vota in tempo non prende nulla né perde nulla; se non vota nessuno, niente punti e niente cade", () => {
    const s = toMini(4, "peggiore");
    const a = ended(voteList(s, [["p1", 2], ["p2", 2]])).miniResult!;
    expect(a.votes).toEqual({ p1: 2, p2: 2 }); expect(a.points).toEqual({ p1: 6, p2: 2, p3: 0, p4: 0 });
    const b = ended(s).miniResult!;
    expect(b.leaders).toEqual([]); expect(b.fallenPositions).toEqual([]); expect(b.fastest).toBeNull(); expect(Object.values(b.points).every((x) => x === 0)).toBe(true);
  });
  it("i punti vanno ai punteggi; la propria carta non esiste (nessun divieto)", () => {
    const s = toMini(4, "accusa"), before = { ...s.scores };
    const g = ended(voteList(s, [["p1", 1], ["p2", 1]]));
    expect(g.scores.p1).toBe(before.p1! + 6); expect(g.scores.p2).toBe(before.p2! + 2); expect(g.scores.p3).toBe(before.p3);
  });
});

describe("intervallo a tempo: regole del motore", () => {
  it("un voto solo, posizioni 1–6, endRun solo durante la corsa", () => {
    const s = toMini(4, "accusa");
    const g = act(s, { type: "vote", playerId: "p1", position: 3 });
    expect(() => act(g, { type: "vote", playerId: "p1", position: 4 })).toThrow(EngineError);
    expect(() => act(s, { type: "vote", playerId: "p2", position: 7 })).toThrow(EngineError);
    expect(() => act(s, { type: "vote", playerId: "p2", position: 0 })).toThrow(EngineError);
    expect(() => act(s, { type: "playCard", playerId: "p1", cardId: s.hands.p1![0]! })).toThrow(EngineError);
    expect(() => act(act(s, { type: "endRun" }), { type: "endRun" })).toThrow(EngineError);
  });
  it("si risolve da sola quando hanno votato tutti; poi 'advance' riprende con il turno successivo e le mani sono tutte nuove", () => {
    const s = toMini(4, "amore"), oldHands = s.hands, mega = s.megafonoIndex, turn = s.turnNumber, towerCards = s.tower.map((t) => t.cardId);
    const r = voteList(s, [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4]]);
    expect(r.phase).toBe("MINI_RESULTS");
    const n = act(r, { type: "advance" });
    expect(n.phase).toBe("PROCLAIM"); expect(n.turnNumber).toBe(turn + 1); expect(n.megafonoIndex).toBe((mega + 1) % 4);
    for (const p of n.playerIds) {   // mano rinnovata: 5 carte, nessuna di prima; quelle vecchie nello scarto (o rimescolate nel mazzo)
      expect(n.hands[p]).toHaveLength(5);
      for (const c of n.hands[p]!) expect(oldHands[p]).not.toContain(c);
    }
    for (const c of towerCards) expect([...n.discardPile, ...n.drawPile]).toContain(c);
    expect(checkInvariants(n, makeDeck(125))).toEqual([]);
  });
  it("la vista mostra i 6 personaggi e la corsa; i risultati solo alla fine", () => {
    const s = toMini(4, "peggiore");
    expect(viewFor(s, "p2").tower).toHaveLength(6); expect(viewFor(s, "p2").miniResult).toBeNull();
    const r = ended(voteList(s, [["p1", 2]]));
    expect(viewFor(r, "p3").miniResult!.votes).toEqual({ p1: 2 });
  });
});

describe("partite complete con l'intervallo a tempo", () => {
  it("ogni mini-gioco, da 3 a 6 giocatori: invarianti rispettate, partita conclusa, il numero giusto di intervalli", () => {
    for (const kind of ["accusa", "amore", "peggiore", "random"] as const) for (const n of [3, 5, 6]) {
      const { state, problems, log } = simulateGame(cfg(n, { miniGame: kind, accuseDeck: ["Mi ha rubato il panino!"], seed: 11 + n }), 5, { checkEveryStep: true });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
      expect(log.flatMap((l) => l.events).filter((e) => e.type === "miniStarted")).toHaveLength(n <= 5 ? 1 : 2);
    }
  });
  it("senza miniGame non cambia nulla", () => {
    const { log } = simulateGame(cfg(4), 5);
    expect(log.flatMap((l) => l.events).some((e) => e.type === "miniStarted")).toBe(false);
  });
});

describe("numero di intervalli", () => {
  it("1 fino a 5 giocatori, 2 con 6 (mini-giochi diversi tra loro), ai turni previsti", () => {
    for (const n of [3, 4, 5, 6]) {
      let s = start(n, { miniGame: "random", accuseDeck: ["Mi ha rubato il panino!"] }), g = 0, r = n * 13 + 1; const at: number[] = [];
      const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      while (s.phase !== "GAME_OVER" && g++ < 5000) {
        if (s.phase === "MINI_RUN" && !at.includes(s.turnNumber)) at.push(s.turnNumber);
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

void applyAction;
