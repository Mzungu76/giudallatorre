import { describe, expect, it } from "vitest";
import { applyAction, createGame, megafonoOf, viewFor } from "../src/index.ts";
import type { Action, GameState } from "../src/index.ts";

const deck = Array.from({ length: 60 }, (_, i) => `c${i}`);
const phraseDeck = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, phrases: [`Oggi sale sulla torre chi cosa ${i}.`] }));
const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));

/** Porta una partita fino a VOTE con il Lui! sulla posizione `luiPos`. */
function toVote(opts: { slot?: "k1" | "k3" | "zero"; luiPos?: number }): GameState {
  let s = createGame({ players, seed: 5, deck, phraseDeck, luiSlots: ["k1", "k2", "k3", "zero"], ...opts }).state;
  const mega = megafonoOf(s);
  s = applyAction(s, { type: "choosePhrase", playerId: mega, mode: "card", index: 0 }).state;
  for (const p of s.playerIds) if (p !== mega) s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![0]! }).state;
  s = applyAction(s, { type: "placeLui", playerId: mega, slot: opts.slot ?? "k1", position: opts.luiPos ?? 1 }).state;
  return s;
}
const voteAll = (s: GameState, pos: Record<string, number>) => {
  for (const p of s.playerIds) s = applyAction(s, { type: "vote", playerId: p, position: pos[p]! }).state;
  return s;
};

describe("il Megafono fa punti come gli altri più il Lui!", () => {
  const mega = (s: GameState) => megafonoOf(s);
  it("se vota la carta che cade prende il voto giusto +2, e nessun bonus per i voti degli altri sulla sua carta", () => {
    const base = toVote({ slot: "zero", luiPos: 1 }), m = mega(base);
    const r = voteAll(base, Object.fromEntries(base.playerIds.map((p) => [p, 2]))).lastResult!;
    expect(r.fallenPosition).toBe(2);
    for (const p of base.playerIds) {
      const owner = r.fallenOwnerId === p ? 2 : 0;
      expect(r.points[p]).toBe(2 + owner + (p === m && r.lui?.hit ? r.lui.pts : 0));
    }
  });
  it("se la carta votata dal Megafono non cade non prende nulla (senza Lui! azzeccato)", () => {
    const base = toVote({ slot: "k3", luiPos: 3 }), m = mega(base);
    const votes = Object.fromEntries(base.playerIds.map((p) => [p, p === m ? 1 : 2]));
    const r = voteAll(base, votes).lastResult!;
    expect(r.fallenPosition).toBe(2);
    expect(r.points[m]).toBe(r.fallenOwnerId === m ? 2 : 0);
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
