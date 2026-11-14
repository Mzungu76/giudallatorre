import { describe, expect, it } from "vitest";
import { castVotes, posOf, start, toSuspect, act, toVote } from "./helpers.ts";
import { viewFor, megafonoOf } from "../src/index.ts";

describe("separazione dati pubblici e privati (vista per giocatore)", () => {
  it("il giocatore vede solo la propria mano; degli altri solo il numero di carte", () => {
    const s = start(5), v = viewFor(s, "p2");
    expect(v.myHand).toEqual(s.hands.p2);
    expect(v.players.find((p) => p.id === "p3")!.handCount).toBe(5);
    const json = JSON.stringify(v);
    for (const c of s.hands.p3!) expect(json).not.toContain(`"${c}"`);
    for (const c of s.drawPile.slice(0, 20)) expect(json).not.toContain(`"${c}"`);
    expect(json).not.toContain("\"drawPile\""); expect(json).not.toContain("\"rng\"");
  });
  it("la carta frase pescata è visibile solo al Megafono", () => {
    const s = start(4);
    expect(viewFor(s, "p1").proclaimCard).not.toBeNull();
    expect(viewFor(s, "p2").proclaimCard).toBeNull();
    expect(JSON.stringify(viewFor(s, "p2"))).not.toContain(s.proclaim!.phrases[0]!);
  });
  it("durante la partita i proprietari delle carte in Torre sono nascosti; si svelano ai risultati", () => {
    const g = toSuspect(start(5));
    for (const p of g.playerIds) expect(viewFor(g, p).tower.every((t) => t.ownerId === null)).toBe(true);
    const v = act(g, { type: "placeMarks", playerId: "p1", marks: [{ slot: "noncade", position: 1 }] });
    const f = posOf(v, "p2"), r = castVotes(v, Object.fromEntries(v.playerIds.map((p) => [p, f])));
    expect(viewFor(r, "p3").tower.some((t) => t.ownerId === "p2")).toBe(true);
  });
  it("chi ha già giocato è pubblico, quale carta no (prima della rivelazione)", () => {
    let g = act(start(4), { type: "choosePhrase", playerId: "p1", mode: "free" });
    const card = g.hands.p2![0]!;
    g = act(g, { type: "playCard", playerId: "p2", cardId: card });
    const v = viewFor(g, "p3");
    expect(v.players.find((p) => p.id === "p2")!.hasPlayed).toBe(true);
    expect(JSON.stringify(v)).not.toContain(card);
    expect(viewFor(g, "p2").myHand).not.toContain(card);
  });
  it("i voti restano segreti fino ai risultati: ciascuno vede solo il proprio", () => {
    let g = toVote(start(4));
    g = act(g, { type: "vote", playerId: "p2", position: 3 });
    expect(viewFor(g, "p2").myVote).toBe(3);
    const v3 = viewFor(g, "p3");
    expect(v3.myVote).toBeNull(); expect(v3.votes).toBeNull();
    expect(v3.players.find((p) => p.id === "p2")!.hasVoted).toBe(true);
  });
  it("quale segnalino è stato posato lo conosce solo il Megafono finché non si risolve; la posizione è pubblica", () => {
    const g = toVote(start(4), { slot: "nulli", position: 2 });
    expect(viewFor(g, "p1").marks).toEqual([{ position: 2, slot: "nulli" }]);
    expect(viewFor(g, "p2").marks).toEqual([{ position: 2, slot: null }]);
    expect(JSON.stringify(viewFor(g, "p3"))).not.toContain("nulli\",\"position");
    const r = castVotes(g, { p1: 1, p2: 1, p3: 1, p4: 1 });
    expect(viewFor(r, "p2").marks).toEqual([{ position: 2, slot: "nulli" }]);
    expect(viewFor(r, "p2").votes).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
  });
  it("un giocatore sconosciuto non ottiene mani", () => {
    expect(viewFor(start(3), "intruso").myHand).toEqual([]);
    expect(megafonoOf(start(3))).toBe("p1");
  });
});
