import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyAction, buildPhraseDeck, chooseBotAction, createGame, learnFromResult, megafonoOf, newBotMemory, parseAge, registerTags } from "../src/index.ts";
import type { BotLevel, GameState, PlayerId, PoolConfession, PoolPhrase } from "../src/index.ts";

const json = (p: string) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const manifest = (json("public/cards/manifest.json") as { id: string; overlay_of?: string }[]).filter((m) => !m.overlay_of).map((m) => m.id);
const pool: PoolPhrase[] = (json("content/frasi-megafono.json").frasi as { id: string; testo: string; verbo: "sale"; famiglia: "etichetta"; eta: string }[]).map((f) => ({ id: f.id, text: f.testo, verb: f.verbo, family: f.famiglia, age: parseAge(f.eta) }));
const confessions: PoolConfession[] = (json("content/confessioni.json").confessioni as { id: string; testo: string; eta: string }[]).map((c) => ({ id: c.id, text: c.testo, age: parseAge(c.eta) }));

const lcg = (seed: number) => { let r = seed % 2147483647 || 1; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

/**
 * Lo stato com'è visto da `me`: tutto ciò che un giocatore seduto al tavolo NON può sapere viene alterato.
 * Se un bot decidesse in base a una di queste informazioni, la sua scelta cambierebbe e il test fallirebbe.
 */
function hideFrom(s: GameState, me: PlayerId): GameState {
  const t = structuredClone(s), others = t.playerIds.filter((p) => p !== me), mega = megafonoOf(t);
  for (const p of others) t.hands[p] = t.hands[p]!.map((_, k) => `carta-finta-${p}-${k}`);                  // mani degli altri
  for (const p of others) if (t.played[p] !== undefined) t.played[p] = "carta-finta-giocata";               // carte giocate coperte
  if (t.deckCard !== null) t.deckCard = "carta-finta-mazzo";                                               // carta pescata dal mazzo, coperta
  for (const p of others) if (t.votes[p] !== undefined && t.phase.endsWith("VOTE")) t.votes[p] = (t.votes[p]! % Math.max(1, t.tower.length)) + 1; // voti degli altri, segreti
  let k = 0;                                                                                                // proprietari delle carte sulla Torre (tranne la propria)
  for (const sl of t.tower) if (sl.ownerId !== null && sl.ownerId !== me) { sl.ownerId = others[(++k) % others.length]!; }
  if (t.lui && me !== mega) t.lui.slot = t.lui.slot === "zero" ? "k1" : "zero";                            // quale segnalino ha giocato il Megafono
  if (me !== mega) t.proclaim = null;                                                                      // la carta frase è solo del Megafono
  t.drawPile = t.drawPile.slice().reverse(); t.discardPile = t.discardPile.slice().reverse();              // ordine dei mazzi
  t.phraseDraw = t.phraseDraw.slice().reverse(); t.rng = (t.rng + 7) | 0;
  return t;
}

describe("fair play dei giocatori virtuali", () => {
  it("nessun bot usa informazioni nascoste: né mani, carte giocate, voti, proprietari, segnalino o mazzi altrui, né accordi con gli altri bot", () => {
    registerTags(json("content/tags-personaggi.json"), json("content/tags-frasi.json"));   // con le etichette reali, come nel gioco
    const seen: Record<string, number> = {}; let compared = 0;
    for (const n of [3, 4, 6, 8]) for (let seed = 1; seed <= 3; seed++) {
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `B${i + 1}` }));
      const levelOf = (id: PlayerId): BotLevel => (["easy", "medium", "hard"] as const)[(Number(id.slice(1)) + seed) % 3]!;
      let s = createGame({ players, seed: seed * 101 + n, deck: manifest, phraseDeck: buildPhraseDeck(pool, confessions, { age: 18, seed }), miniGame: "random", accuseDeck: ["Mi ha rubato il panino!"] }).state;
      const mem = newBotMemory(); let guard = 0;
      while (s.phase !== "GAME_OVER" && guard++ < 4000) {
        let moved = false;
        for (const p of s.playerIds) {
          const real = chooseBotAction(s, p, levelOf(p), mem, lcg(seed + guard)), hidden = chooseBotAction(hideFrom(s, p), p, levelOf(p), mem, lcg(seed + guard));
          expect(hidden, `${s.phase} ${p} ${levelOf(p)}`).toEqual(real);
          if (real) { compared++; seen[s.phase] = (seen[s.phase] ?? 0) + 1; s = applyAction(s, real).state; moved = true; break; }
        }
        if (moved) continue;
        const before = s.phase, tower = s.tower;
        s = applyAction(s, { type: "advance" }).state;
        if (before === "RESULTS" && s.lastResult) learnFromResult(mem, tower, s.lastResult);
      }
      expect(s.phase).toBe("GAME_OVER");
    }
    // la prova ha davvero toccato tutte le fasi in cui un bot decide
    for (const ph of ["PROCLAIM", "PLAY", "SUSPECT", "VOTE", "MINI_PLAY", "MINI_VOTE"]) expect(seen[ph] ?? 0, ph).toBeGreaterThan(20);
    expect(compared).toBeGreaterThan(300);
  });

  it("il controllo è efficace: lo stato alterato è davvero diverso da quello reale", () => {
    const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i + 1}`, name: `B${i + 1}` }));
    let s = createGame({ players, seed: 5, deck: manifest, phraseDeck: buildPhraseDeck(pool, confessions, { age: 18, seed: 5 }), firstMegafonoIndex: 0 }).state;
    s = applyAction(s, { type: "choosePhrase", playerId: "p1", mode: "card", index: 0 }).state;
    expect(JSON.stringify(hideFrom(s, "p2"))).not.toBe(JSON.stringify(s));
    expect(hideFrom(s, "p2").hands.p3).not.toEqual(s.hands.p3);
    expect(hideFrom(s, "p2").hands.p2).toEqual(s.hands.p2);   // la propria mano resta visibile
  });

  it("la memoria condivisa dei bot contiene solo informazioni pubbliche (carte mostrate e cadute, mai mani o proprietari)", () => {
    const mem = newBotMemory();
    learnFromResult(mem, [{ cardId: "a" }, { cardId: "b" }], { fallenCardId: "a", fallenCardIds: ["a"] } as never);
    expect(Object.keys(mem).sort()).toEqual(["fell", "lui", "shown", "turns"]);
    expect(mem.shown).toEqual({ a: 1, b: 1 }); expect(mem.fell).toEqual({ a: 1 }); expect(mem.lui).toEqual({});
  });
});
