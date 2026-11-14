import { describe, expect, it } from "vitest";
import { act, castVotes, posOf, start, toSuspect, cfg, makeDeck } from "./helpers.ts";
import { applyAction, checkInvariants, megafonoOf, simulateGame, createGame, suggestAction, viewFor, GOLDEN_GOAL_MAX_TURNS } from "../src/index.ts";
import type { GameState } from "../src/index.ts";

function finishTurn(s: ReturnType<typeof start>) {
  const g = act(toSuspect(s), { type: "placeMarks", playerId: megafonoOf(toSuspect(s)), marks: [{ slot: "noncade", position: 1 }] });
  return castVotes(g, Object.fromEntries(g.playerIds.map((p) => [p, 1])));
}

describe("fine turno e rotazione", () => {
  it("scarta la Torre, tutti pescano 1 carta, il Megafono passa al giocatore successivo", () => {
    const r = finishTurn(start(4));
    const n = act(r, { type: "advance" });
    expect(n.turnNumber).toBe(2); expect(megafonoOf(n)).toBe("p2"); expect(n.phase).toBe("PROCLAIM");
    for (const p of n.playerIds) expect(n.hands[p]).toHaveLength(5);
    expect(checkInvariants(n, makeDeck(125))).toEqual([]);
    expect(Object.values(n.hands).flat().length + n.drawPile.length + n.discardPile.length).toBe(125);
    expect(n.tower).toHaveLength(0); expect(n.marks).toBeNull(); expect(n.votes).toEqual({}); expect(n.proclaim).not.toBeNull();
    expect(n.megafonoTurns.p1).toBe(1);
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
  it.each([3, 4, 5, 6, 7, 8])("%i giocatori: i giri regolari sono completi (ognuno fa il Megafono) e la partita termina con un solo vincitore o dopo lo spareggio", (n) => {
    const { state, log, problems } = simulateGame(cfg(n, { seed: n }), 11);
    expect(problems).toEqual([]);
    const rounds = n === 3 ? 2 : 1;
    for (const p of state.playerIds) expect(state.megafonoTurns[p]).toBeGreaterThanOrEqual(rounds);
    expect(log.filter((l) => l.action.type === "advance").length).toBe(n * rounds + state.goldenTurns);
    expect(state.phase).toBe("GAME_OVER");
  });
  it("vince chi ha più punti", () => {
    const { state } = simulateGame(cfg(5), 4);
    const best = Math.max(...Object.values(state.scores));
    expect(state.winners).toEqual(state.playerIds.filter((p) => state.scores[p] === best));
  });
  it("parità in testa a fine partita: si gioca a oltranza (Golden goal) finché c'è un solo primo, anche con giocatori non in parità", () => {
    let seen = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { state } = simulateGame(cfg(3, { seed }), seed);
      if (state.goldenTurns > 0) {
        seen++;
        const best = Math.max(...Object.values(state.scores));
        expect(state.playerIds.filter((p) => state.scores[p] === best)).toHaveLength(1);   // un solo vincitore
        expect(state.winners).toHaveLength(1);
        expect(state.totalTurns).toBe(6 + state.goldenTurns);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it("Golden goal: dopo la parità finale lo stato lo segnala (evento e vista) e il turno seguente è un turno normale", () => {
    const c = cfg(3, { seed: 1 });
    // cerco un seme che arrivi allo spareggio
    for (let seed = 1; seed < 400; seed++) {
      let { state: s } = createGame({ ...c, seed });
      let r = seed, rand = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296), sawEvent = false;
      while (s.phase !== "GAME_OVER") {
        if (s.phase === "RESULTS") { const res = applyAction(s, { type: "advance" }); s = res.state; if (res.events.some((e) => e.type === "goldenGoal")) { sawEvent = true; expect(s.goldenGoal).toBe(true); expect(s.phase).toBe("PROCLAIM"); expect(viewFor(s, "p1").goldenGoal).toBe(true); } continue; }
        for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = applyAction(s, a).state; break; } }
      }
      if (sawEvent) return;
    }
    throw new Error("nessuna partita è arrivata allo spareggio");
  });
  it("limite di sicurezza: oltre GOLDEN_GOAL_MAX_TURNS la vittoria resta condivisa", () => {
    const g = start(3);
    const tie = { ...g, phase: "RESULTS" as const, goldenTurns: GOLDEN_GOAL_MAX_TURNS, scores: { p1: 5, p2: 5, p3: 1 }, megafonoTurns: { p1: 2, p2: 2, p3: 1 }, megafonoIndex: 2,
      lastResult: null, tower: [], hands: g.hands };
    const out = applyAction(tie, { type: "advance" }).state;
    expect(out.phase).toBe("GAME_OVER"); expect(out.winners).toEqual(["p1", "p2"]);
  });
  it("il Megafono ruota sempre in ordine di tavolo", () => {
    const { log, initialEvents } = simulateGame(cfg(6, { firstMegafonoIndex: 2 }), 2);
    const megas = [...initialEvents, ...log.flatMap((l) => l.events)].filter((e) => e.type === "turnStarted").map((e) => (e as { megafonoId: string }).megafonoId);
    expect(megas.slice(0, 6)).toEqual(["p3", "p4", "p5", "p6", "p1", "p2"]);   // poi eventuali turni di spareggio, sempre in ordine
  });
});

describe("robustezza", () => {
  it("ripristino dopo interruzione: far passare lo stato per JSON a ogni azione non cambia l'esito", () => {
    const c = cfg(5, { seed: 21 }), full = simulateGame(c, 8);
    let state = createGame(c).state;
    for (const { action } of full.log) state = applyAction(JSON.parse(JSON.stringify(state)) as GameState, action).state;
    expect(state).toEqual(full.state);
  });
  it("molte partite simulate (3–8 giocatori) rispettano le invarianti", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) for (let seed = 1; seed <= 12; seed++) {
      const { state, problems } = simulateGame(cfg(n, { seed }), seed * 7, { checkEveryStep: seed <= 2 });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
      expect(Object.values(state.scores).every((v) => Number.isInteger(v))).toBe(true);
      expect(checkInvariants(state, makeDeck(125))).toEqual([]);
    }
  });
  it("determinismo: stessa configurazione e stessi bot = stessa partita", () => {
    expect(simulateGame(cfg(7, { seed: 5 }), 99).state).toEqual(simulateGame(cfg(7, { seed: 5 }), 99).state);
  });
});

