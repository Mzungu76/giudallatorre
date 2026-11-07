import { describe, expect, it } from "vitest";
import { applyAction, createGame, megafonoOf, viewFor } from "../src/index.ts";
import type { Action, GameState } from "../src/index.ts";

const deck = Array.from({ length: 60 }, (_, i) => `c${i}`);
const phraseDeck = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, phrases: [`Oggi sale sulla torre chi cosa ${i}.`] }));
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));

/** Porta una partita fino a VOTE con il Lui! sulla posizione `luiPos`. */
function toVote(opts: { kind?: "CADE" | "NON_CADE"; luiPos?: number }): GameState {
  let s = createGame({ players, seed: 5, deck, phraseDeck, ...opts }).state;
  const mega = megafonoOf(s);
  s = applyAction(s, { type: "choosePhrase", playerId: mega, mode: "card", index: 0 }).state;
  for (const p of s.playerIds) if (p !== mega) s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![0]! }).state;
  s = applyAction(s, { type: "placeLui", playerId: mega, kind: opts.kind ?? "CADE", position: opts.luiPos ?? 1 }).state;
  return s;
}
const voteAll = (s: GameState, pos: Record<string, number>) => {
  for (const p of s.playerIds) s = applyAction(s, { type: "vote", playerId: p, position: pos[p]! }).state;
  return s;
};

describe("regola del gregge (sempre attiva)", () => {
  const mega = (s: GameState) => megafonoOf(s);
  it("Lui! CADE indovinato: i +2 dei votanti vanno solo al Megafono", () => {
    const base = toVote({ luiPos: 2 }), m = mega(base);
    const votes = Object.fromEntries(base.playerIds.map((p) => [p, 2]));
    const r = voteAll(base, votes).lastResult!;
    expect(r.herd).toBe(true);
    for (const p of base.playerIds) {
      if (p === m) expect(r.points[p]).toBe(2 + 4 + (r.fallenOwnerId === p ? 2 : 0));
      else { expect(r.reasons[p]).toContain("gregge"); expect(r.points[p]).toBe(r.fallenOwnerId === p ? 2 : 0); }
    }
  });
  it("Megafono che non ha votato la carta caduta non prende il +2 dei votanti", () => {
    const base = toVote({ luiPos: 2 }), m = mega(base);
    const votes = Object.fromEntries(base.playerIds.map((p) => [p, p === m ? 1 : 2]));
    const r = voteAll(base, votes).lastResult!;
    expect(r.fallenPosition).toBe(2); expect(r.points[m]).toBe(4 + (r.fallenOwnerId === m ? 2 : 0));
  });
  it("senza Lui! CADE azzeccato i punti sono quelli di sempre", () => {
    const base = toVote({ kind: "NON_CADE", luiPos: 1 }), votes = Object.fromEntries(base.playerIds.map((p) => [p, 2]));
    const r = voteAll(base, votes).lastResult!; expect(r.herd).toBe(false);
    for (const p of base.playerIds) expect(r.points[p]).toBeGreaterThanOrEqual(2 - (p === mega(base) ? 1 : 0) - 1);
  });
});

describe("contesto della frase", () => {
  it("il tema della carta frase arriva al Megafono e poi a tutti con la frase scelta", () => {
    let s = createGame({ players, seed: 9, deck, phraseDeck: phraseDeck.map((c) => ({ ...c, theme: "In palestra" })) }).state;
    const mega = megafonoOf(s);
    expect(viewFor(s, mega).proclaimCard!.theme).toBe("In palestra");
    s = applyAction(s, { type: "choosePhrase", playerId: mega, mode: "card", index: 0 }).state;
    const ph = viewFor(s, s.playerIds.find((p) => p !== mega)!).phrase;
    expect(ph && ph.mode === "card" && ph.theme).toBe("In palestra");
  });
});

describe("frasi mescolate a caso", () => {
  const cards = Array.from({ length: 6 }, (_, c) => ({ id: `k${c}`, phrases: Array.from({ length: 5 }, (_, i) => `frase ${c}-${i}`), themes: Array.from({ length: 5 }, (_, i) => `ctx ${c}-${i}`) }));
  it("ogni frase tiene il proprio contesto anche dopo il rimescolamento, e le carte non sono più quelle di partenza", () => {
    const seen = new Set<string>(); let regrouped = false;
    for (let seed = 1; seed <= 20; seed++) {
      let s = createGame({ players, seed, deck, phraseDeck: cards, mixPhrases: true }).state;
      const proclaim = (s: GameState) => viewFor(s, megafonoOf(s)).proclaimCard!;
      const pc = proclaim(s);
      pc.phrases.forEach((f, i) => expect(pc.themes![i]).toBe(f.replace("frase", "ctx")));
      if (new Set(pc.phrases.map((f) => f.split(" ")[1]!.split("-")[0])).size > 1) regrouped = true;
      const mega = megafonoOf(s); s = applyAction(s, { type: "choosePhrase", playerId: mega, mode: "card", index: 2 }).state;
      const ph = viewFor(s, mega).phrase!; expect(ph.mode === "card" && ph.theme).toBe(pc.themes![2]);
      pc.phrases.forEach((f) => seen.add(f));
    }
    expect(regrouped).toBe(true); expect(seen.size).toBeGreaterThan(20);
  });
  it("senza l'opzione le carte restano com'erano", () => {
    const s = createGame({ players, seed: 3, deck, phraseDeck: cards }).state;
    const pc = viewFor(s, megafonoOf(s)).proclaimCard!; expect(new Set(pc.phrases.map((f) => f.split(" ")[1]!.split("-")[0])).size).toBe(1);
  });
});
