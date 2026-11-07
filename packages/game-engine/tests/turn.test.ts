import { describe, expect, it } from "vitest";
import { applyAction, megafonoOf, requiredPlayers, EngineError } from "../src/index.ts";
import { act, castVotes, start, toSuspect, toVote } from "./helpers.ts";

const err = (fn: () => unknown, code: string) => { try { fn(); } catch (e) { expect(e).toBeInstanceOf(EngineError); expect((e as EngineError).code).toBe(code); return; } throw new Error("nessun errore"); };

describe("fase Su sulla Torre (frase)", () => {
  it("solo il Megafono sceglie la frase", () => {
    const s = start(4);
    err(() => applyAction(s, { type: "choosePhrase", playerId: "p2", mode: "free" }), "NOT_ALLOWED");
    err(() => applyAction(s, { type: "choosePhrase", playerId: "zz", mode: "free" }), "UNKNOWN_PLAYER");
  });
  it("carta a 5 frasi: ne sceglie una; indice fuori intervallo rifiutato", () => {
    let s = start(4); while (s.proclaim!.phrases.length === 1) s = start(4, { seed: s.rng + 1 });
    err(() => applyAction(s, { type: "choosePhrase", playerId: "p1", mode: "card", index: 5 }), "INVALID_CHOICE");
    const n = act(s, { type: "choosePhrase", playerId: "p1", mode: "card", index: 3 });
    expect(n.phrase).toMatchObject({ mode: "card", index: 3 }); expect(n.phase).toBe("PLAY"); expect(n.proclaim).toBeNull();
  });
  it("carta a frase singola: DEVE pronunciare quella frase", () => {
    let seed = 1, s = start(4, { seed });
    while (s.proclaim!.phrases.length !== 1) s = start(4, { seed: ++seed });
    err(() => applyAction(s, { type: "choosePhrase", playerId: "p1", mode: "card", index: 1 }), "INVALID_CHOICE");
    expect(act(s, { type: "choosePhrase", playerId: "p1", mode: "card", index: 0 }).phase).toBe("PLAY");
  });
  it("frase inventata: la carta frase torna nello scarto", () => {
    const s = start(4), n = act(s, { type: "choosePhrase", playerId: "p1", mode: "free" });
    expect(n.phrase).toEqual({ mode: "free" }); expect(n.phraseDiscard).toHaveLength(1);
  });
});

describe("fase di gioco delle carte", () => {
  it("modalità base: la Folla gioca, il Megafono NON gioca e la Torre ha N carte (N-1 giocate + 1 dal mazzo)", () => {
    for (const n of [3, 5, 8]) {
      let g = act(start(n), { type: "choosePhrase", playerId: "p1", mode: "free" });
      expect(g.deckCard).not.toBeNull();
      err(() => applyAction(g, { type: "playCard", playerId: "p1", cardId: g.hands.p1![0]! }), "NOT_ALLOWED");
      for (const p of requiredPlayers(g)) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! });
      expect(g.phase).toBe("SUSPECT"); expect(g.tower).toHaveLength(n);
      expect(g.tower.filter((t) => t.ownerId === null)).toHaveLength(1);
      expect(g.tower.map((t) => t.position)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(g.hands.p1).toHaveLength(5);
    }
  });
  it("variante 'Il Megafono sa': anche il Megafono gioca dalla mano; nessuna carta dal mazzo; Torre di N carte", () => {
    let g = act(start(4, { megafonoSa: true }), { type: "choosePhrase", playerId: "p1", mode: "free" });
    expect(g.deckCard).toBeNull();
    for (const p of requiredPlayers(g)) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! });
    expect(g.tower).toHaveLength(4); expect(g.tower.every((t) => t.ownerId !== null)).toBe(true);
    expect(g.hands.p1).toHaveLength(4);
  });
  it("controlli: carta non in mano, doppio invio, fuori fase", () => {
    let g = act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free" });
    err(() => applyAction(g, { type: "playCard", playerId: "p2", cardId: "c999" }), "CARD_NOT_IN_HAND");
    err(() => applyAction(g, { type: "playCard", playerId: "p2", cardId: g.hands.p3![0]! }), "CARD_NOT_IN_HAND"); // carta altrui
    g = act(g, { type: "playCard", playerId: "p2", cardId: g.hands.p2![0]! });
    err(() => applyAction(g, { type: "playCard", playerId: "p2", cardId: g.hands.p2![0]! }), "ALREADY_DONE");
    err(() => applyAction(g, { type: "vote", playerId: "p2", position: 1 }), "WRONG_PHASE");
    err(() => applyAction(g, { type: "placeLui", playerId: "p1", slot: "bassa", position: 1 }), "WRONG_PHASE");
  });
  it("la Torre non rivela nulla finché non hanno giocato tutti", () => {
    let g = act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free" });
    g = act(g, { type: "playCard", playerId: "p2", cardId: g.hands.p2![0]! });
    g = act(g, { type: "playCard", playerId: "p3", cardId: g.hands.p3![0]! });
    expect(g.phase).toBe("PLAY"); expect(g.tower).toHaveLength(0);
  });
});

describe("segnalino Lui! e voto", () => {
  it("solo il Megafono posa il Lui!, su una posizione valida", () => {
    const g = toSuspect(start(4));
    err(() => applyAction(g, { type: "placeLui", playerId: "p2", slot: "bassa", position: 1 }), "NOT_ALLOWED");
    err(() => applyAction(g, { type: "placeLui", playerId: "p1", slot: "bassa", position: 0 }), "INVALID_POSITION");
    err(() => applyAction(g, { type: "placeLui", playerId: "p1", slot: "bassa", position: 5 }), "INVALID_POSITION");
    err(() => applyAction(g, { type: "placeLui", playerId: "p1", slot: "BOH" as never, position: 1 }), "INVALID_CHOICE");
    err(() => applyAction(g, { type: "vote", playerId: "p2", position: 1 }), "WRONG_PHASE"); // non si vota prima del Lui!
    expect(act(g, { type: "placeLui", playerId: "p1", slot: "zero", position: 2 }).phase).toBe("VOTE");
  });
  it("tutti votano, Megafono incluso; si può votare la propria carta e quella del mazzo; niente doppi voti", () => {
    let g = toVote(start(4));
    g = act(g, { type: "vote", playerId: "p2", position: 1 });
    err(() => applyAction(g, { type: "vote", playerId: "p2", position: 2 }), "ALREADY_DONE");
    err(() => applyAction(g, { type: "vote", playerId: "p3", position: 9 }), "INVALID_POSITION");
    err(() => applyAction(g, { type: "vote", playerId: "p3", position: 1.5 }), "INVALID_POSITION");
    const mine = g.tower.find((t) => t.ownerId === "p3")!.position, deck = g.tower.find((t) => t.ownerId === null)!.position;
    g = act(g, { type: "vote", playerId: "p3", position: mine });
    g = act(g, { type: "vote", playerId: "p1", position: deck });
    expect(g.phase).toBe("VOTE");
    g = act(g, { type: "vote", playerId: "p4", position: 1 });
    expect(g.phase).toBe("RESULTS");
  });
  it("lo stato di input non viene mai modificato", () => {
    const g = toVote(start(4)), snap = JSON.stringify(g);
    applyAction(g, { type: "vote", playerId: "p2", position: 1 });
    try { applyAction(g, { type: "vote", playerId: "zz", position: 1 }); } catch { /* atteso */ }
    expect(JSON.stringify(g)).toBe(snap);
  });
  it("dopo GAME_OVER nessuna azione è accettata", () => {
    const g = { ...start(3), phase: "GAME_OVER" as const };
    err(() => applyAction(g, { type: "advance" }), "GAME_OVER");
  });
  it("advance è valido solo in RESULTS", () => {
    err(() => applyAction(start(3), { type: "advance" }), "WRONG_PHASE");
    expect(castVotes(toVote(start(3)), { p1: 1, p2: 1, p3: 1 }).phase).toBe("RESULTS");
  });
});

describe("frase personale del Megafono", () => {
  it("la frase inventata viene normalizzata e mostrata a tutti (limite 80 caratteri, nessun filtro sui contenuti)", () => {
    const s = act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free", text: "  chi   risponde\n ai vocali \t con un vocale  " });
    expect(s.phrase).toEqual({ mode: "free", text: "chi risponde ai vocali con un vocale" });
    const ok = act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free", text: "x".repeat(80) });
    expect((ok.phrase as { text: string }).text).toHaveLength(80);
  });
  it("frase troppo lunga o non testuale rifiutata; senza testo resta 'a voce'", () => {
    err(() => applyAction(start(4), { type: "choosePhrase", playerId: "p1", mode: "free", text: "x".repeat(81) }), "INVALID_CHOICE");
    err(() => applyAction(start(4), { type: "choosePhrase", playerId: "p1", mode: "free", text: 5 as never }), "INVALID_CHOICE");
    expect(act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free" }).phrase).toEqual({ mode: "free" });
    expect(act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free", text: "   " }).phrase).toEqual({ mode: "free" });
  });
});
