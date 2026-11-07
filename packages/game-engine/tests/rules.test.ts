import { describe, expect, it } from "vitest";
import { applyAction, createGame, megafonoOf, viewFor, MAX_REASON_CHARS } from "../src/index.ts";
import type { Action, GameState } from "../src/index.ts";
import { chooseBotAction, newBotMemory } from "../src/index.ts";

const deck = Array.from({ length: 60 }, (_, i) => `c${i}`);
const phraseDeck = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, phrases: [`Oggi sale sulla torre chi cosa ${i}.`] }));
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));

/** Porta una partita fino a VOTE con il Lui! sulla posizione `luiPos`. */
function toVote(opts: { justifyVotes?: boolean; herd?: boolean; kind?: "CADE" | "NON_CADE"; luiPos?: number }): GameState {
  let s = createGame({ players, seed: 5, deck, phraseDeck, ...opts }).state;
  const mega = megafonoOf(s);
  s = applyAction(s, { type: "choosePhrase", playerId: mega, mode: "card", index: 0 }).state;
  for (const p of s.playerIds) if (p !== mega) s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![0]! }).state;
  s = applyAction(s, { type: "placeLui", playerId: mega, kind: opts.kind ?? "CADE", position: opts.luiPos ?? 1 }).state;
  return s;
}
const voteAll = (s: GameState, pos: Record<string, number>, reason = "perché sì") => {
  for (const p of s.playerIds) s = applyAction(s, { type: "vote", playerId: p, position: pos[p]!, ...(s.justifyVotes ? { reason } : {}) }).state;
  return s;
};

describe("regola da testare: motivazione del voto", () => {
  it("con la regola spenta il voto non richiede testo", () => {
    const s = voteAll(toVote({}), { a: 1, b: 1, c: 1, d: 1 });
    expect(s.phase).toBe("RESULTS"); expect(s.lastResult!.voteReasons).toEqual({});
  });
  it("con la regola accesa il voto senza testo, vuoto o troppo lungo è rifiutato", () => {
    const s = toVote({ justifyVotes: true }), p = s.playerIds[0]!;
    for (const reason of [undefined, "", "   ", "x".repeat(MAX_REASON_CHARS + 1), 5 as unknown as string])
      expect(() => applyAction(s, { type: "vote", playerId: p, position: 1, reason } as Action)).toThrow();
  });
  it("il testo è ripulito, segreto fino ai risultati e rivelato dopo", () => {
    let s = toVote({ justifyVotes: true });
    const [p0, p1, ...rest] = s.playerIds;
    s = applyAction(s, { type: "vote", playerId: p0!, position: 2, reason: "  ha\tla   faccia\u0000giusta  " }).state;
    expect(s.voteReasons[p0!]).toBe("ha la faccia giusta");
    expect(JSON.stringify(viewFor(s, p1!))).not.toContain("faccia");           // un altro giocatore non lo vede
    for (const p of [p1!, ...rest]) s = applyAction(s, { type: "vote", playerId: p, position: 2, reason: "ok" }).state;
    expect(viewFor(s, p1!).lastResult!.voteReasons[p0!]).toBe("ha la faccia giusta");
  });
  it("i bot scrivono una motivazione quando serve", () => {
    const s = toVote({ justifyVotes: true }), bot = s.playerIds[0]!;
    const a = chooseBotAction(s, bot, "hard", newBotMemory(), () => 0.3);
    expect(a && a.type === "vote" && typeof a.reason === "string" && a.reason.length > 0).toBe(true);
  });
});

describe("regola da testare: gregge", () => {
  const mega = (s: GameState) => megafonoOf(s);
  it("Lui! CADE indovinato: i +2 dei votanti vanno solo al Megafono", () => {
    const base = toVote({ herd: true, luiPos: 2 }), m = mega(base);
    const votes = Object.fromEntries(base.playerIds.map((p) => [p, 2]));
    const r = voteAll(base, votes).lastResult!;
    expect(r.herd).toBe(true);
    for (const p of base.playerIds) {
      if (p === m) expect(r.points[p]).toBe(2 + 4 + (r.fallenOwnerId === p ? 2 : 0));
      else { expect(r.reasons[p]).toContain("gregge"); expect(r.points[p]).toBe(r.fallenOwnerId === p ? 2 : 0); }
    }
  });
  it("Megafono che non ha votato la carta caduta non prende il +2 dei votanti", () => {
    const base = toVote({ herd: true, luiPos: 2 }), m = mega(base);
    const votes = Object.fromEntries(base.playerIds.map((p) => [p, p === m ? 1 : 2]));
    const r = voteAll(base, votes).lastResult!;
    expect(r.fallenPosition).toBe(2); expect(r.points[m]).toBe(4 + (r.fallenOwnerId === m ? 2 : 0));
  });
  it("senza Lui! azzeccato (o con la regola spenta) i punti sono quelli di sempre", () => {
    const base = toVote({ herd: true, kind: "NON_CADE", luiPos: 1 }), votes = Object.fromEntries(base.playerIds.map((p) => [p, 2]));
    const r = voteAll(base, votes).lastResult!; expect(r.herd).toBe(false);
    for (const p of base.playerIds) expect(r.points[p]).toBeGreaterThanOrEqual(2 - (p === mega(base) ? 1 : 0) - 1);
    const off = toVote({ luiPos: 2 }); const r2 = voteAll(off, Object.fromEntries(off.playerIds.map((p) => [p, 2]))).lastResult!;
    expect(r2.herd).toBe(false); for (const p of off.playerIds) expect(r2.reasons[p]).not.toContain("gregge");
  });
});
