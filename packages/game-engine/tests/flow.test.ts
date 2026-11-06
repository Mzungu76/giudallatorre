import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect, cfg, makeDeck } from "./helpers.ts";
import { applyAction, checkInvariants, megafonoOf, simulateGame, createGame } from "../src/index.ts";
import type { GameState } from "../src/index.ts";

function finishTurn(s: ReturnType<typeof start>) {
  const g = act(toSuspect(s), { type: "placeLui", playerId: megafonoOf(toSuspect(s)), kind: "CADE", position: 1 });
  return castVotes(g, Object.fromEntries(g.playerIds.map((p) => [p, 1])));
}

describe("fine turno e rotazione", () => {
  it("scarta la Torre, la Folla pesca 1 carta, il Megafono (modalità base) no, il Megafono passa al giocatore successivo", () => {
    const r = finishTurn(start(4));
    const n = act(r, { type: "advance" });
    expect(n.turnNumber).toBe(2); expect(megafonoOf(n)).toBe("p2"); expect(n.phase).toBe("PROCLAIM");
    for (const p of n.playerIds) expect(n.hands[p]).toHaveLength(5);
    expect(checkInvariants(n, makeDeck(125))).toEqual([]);
    expect(Object.values(n.hands).flat().length + n.drawPile.length + n.discardPile.length).toBe(125);
    expect(n.tower).toHaveLength(0); expect(n.lui).toBeNull(); expect(n.votes).toEqual({}); expect(n.proclaim).not.toBeNull();
    expect(n.megafonoTurns.p1).toBe(1);
  });
  it("variante Megafono sa: pesca anche il Megafono", () => {
    const n = act(finishTurn(start(4, { megafonoSa: true })), { type: "advance" });
    for (const p of n.playerIds) expect(n.hands[p]).toHaveLength(5);
  });
  it("mazzo esaurito: lo scarto viene rimescolato (mazzo minimo, partita completa)", () => {
    for (const n of [3, 5, 8]) {
      const deck = makeDeck(n * 5 + n);
      const { state, problems } = simulateGame(cfg(n, { deck, seed: 9 }), 5, { checkEveryStep: true });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
    }
  });
  it("il mazzo frasi si rimescola quando finisce", () => {
    const { state } = simulateGame(cfg(8, { phraseDeck: [{ id: "x", phrases: ["a"] }, { id: "y", phrases: ["b", "c"] }] }), 3);
    expect(state.phase).toBe("GAME_OVER");
  });
});

describe("fine partita", () => {
  it.each([3, 4, 5, 6, 7, 8])("%i giocatori: tutti fanno il Megafono lo stesso numero di volte e la partita termina", (n) => {
    const { state, log, problems } = simulateGame(cfg(n, { seed: n }), 11);
    expect(problems).toEqual([]);
    const rounds = n <= 5 ? 2 : 1;
    for (const p of state.playerIds) expect(state.megafonoTurns[p]).toBe(rounds);
    expect(log.filter((l) => l.action.type === "advance")).toHaveLength(n * rounds);
    expect(state.phase).toBe("GAME_OVER");
  });
  it("vince chi ha più punti", () => {
    const { state } = simulateGame(cfg(5), 4);
    const best = Math.max(...Object.values(state.scores));
    expect(state.winners).toEqual(state.playerIds.filter((p) => state.scores[p] === best));
  });
  it("la parità finale produce più vincitori (esito reale su molte partite)", () => {
    let multi = 0;
    for (let seed = 1; seed <= 200; seed++) if (simulateGame(cfg(3, { seed }), seed).state.winners!.length > 1) multi++;
    expect(multi).toBeGreaterThan(0);
  });
  it("il Megafono ruota sempre in ordine di tavolo", () => {
    const { log, initialEvents } = simulateGame(cfg(6, { firstMegafonoIndex: 2 }), 2);
    const megas = [...initialEvents, ...log.flatMap((l) => l.events)].filter((e) => e.type === "turnStarted").map((e) => (e as { megafonoId: string }).megafonoId);
    expect(megas).toEqual(["p3", "p4", "p5", "p6", "p1", "p2"]);
  });
});

describe("robustezza", () => {
  it("ripristino dopo interruzione: far passare lo stato per JSON a ogni azione non cambia l'esito", () => {
    const c = cfg(5, { seed: 21 }), full = simulateGame(c, 8);
    let state = createGame(c).state;
    for (const { action } of full.log) state = applyAction(JSON.parse(JSON.stringify(state)) as GameState, action).state;
    expect(state).toEqual(full.state);
  });
  it("molte partite simulate (3–8 giocatori, entrambe le varianti) rispettano le invarianti", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) for (const megafonoSa of [false, true]) for (let seed = 1; seed <= 12; seed++) {
      const { state, problems } = simulateGame(cfg(n, { seed, megafonoSa }), seed * 7, { checkEveryStep: seed <= 2 });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
      expect(Object.values(state.scores).every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
      expect(checkInvariants(state, makeDeck(125))).toEqual([]);
    }
  });
  it("determinismo: stessa configurazione e stessi bot = stessa partita", () => {
    expect(simulateGame(cfg(7, { seed: 5 }), 99).state).toEqual(simulateGame(cfg(7, { seed: 5 }), 99).state);
  });
});

