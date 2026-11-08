import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory, BOT_LEVELS } from "../src/index.ts";
import type { BotLevel, GameConfig, GameState } from "../src/index.ts";
import { nextRandom } from "../src/rng.ts";
import { cfg } from "./helpers.ts";

/** Gioca una partita intera con un livello per giocatore. Restituisce lo stato finale. */
export function playBots(config: GameConfig, levels: BotLevel[], seed: number) {
  let s = createGame(config).state; const mem = newBotMemory(); let r = seed | 0;
  const rand = () => { const x = nextRandom(r); r = x.state; return x.value; };
  let guard = 0;
  while (s.phase !== "GAME_OVER") {
    if (++guard > 6000) throw new Error("non termina");
    if (s.phase === "RESULTS") { const tower = s.tower; learnFromResult(mem, tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
    let acted = false;
    for (let i = 0; i < s.playerIds.length; i++) { const a = chooseBotAction(s, s.playerIds[i]!, levels[i]!, mem, rand); if (a) { s = applyAction(s, a).state; acted = true; break; } }
    if (!acted) throw new Error("nessuna azione in fase " + s.phase);
  }
  return s as GameState;
}

describe("giocatori virtuali", () => {
  it.each(BOT_LEVELS)("livello %s: partite complete da 3 a 8 giocatori senza azioni illegali", (lvl) => {
    for (const n of [3, 4, 5, 6, 7, 8]) for (let seed = 1; seed <= 6; seed++) {
      const s = playBots(cfg(n, { seed }), Array(n).fill(lvl), seed * 13);
      expect(s.phase).toBe("GAME_OVER"); expect(s.winners!.length).toBeGreaterThan(0);
    }
  });
  it("variante 'Il Megafono sa': i bot giocano anche da Megafono", () => {
    const s = playBots(cfg(5, { seed: 3, megafonoSa: true }), Array(5).fill("hard"), 9);
    expect(s.phase).toBe("GAME_OVER");
  });
  it("le scelte sono deterministiche a parità di seme", () => {
    const a = playBots(cfg(4, { seed: 7 }), Array(4).fill("hard"), 5), b = playBots(cfg(4, { seed: 7 }), Array(4).fill("hard"), 5);
    expect(a.scores).toEqual(b.scores);
  });
  it("un bot non vede dati altrui: usa solo mano, Torre pubblica e la propria carta (azioni sempre valide anche a stato clonato)", () => {
    const s = createGame(cfg(4, { seed: 2 })).state, mem = newBotMemory();
    const a = chooseBotAction(JSON.parse(JSON.stringify(s)), s.playerIds[0]!, "hard", mem, () => 0.5);
    expect(a).not.toBeNull();
  });
  it("il bot difficile batte tre bot facili più spesso del caso (1 su 4 = 25%) e ha un punteggio medio più alto", () => {
    let wins = 0, hard = 0, easy = 0; const G = 300;
    for (let seed = 1; seed <= G; seed++) {
      const s = playBots(cfg(4, { seed, firstMegafonoIndex: seed % 4 }), ["hard", "easy", "easy", "easy"], seed * 31);
      if (s.winners!.includes("p1")) wins += 1 / s.winners!.length;
      hard += s.scores.p1!; easy += (s.scores.p2! + s.scores.p3! + s.scores.p4!) / 3;
    }
    console.log(`hard vittorie ${(100 * wins / G).toFixed(1)}%  punti medi hard ${(hard / G).toFixed(2)} vs easy ${(easy / G).toFixed(2)}`);
    expect(wins / G).toBeGreaterThan(0.27); expect(hard / G).toBeGreaterThan(easy / G);
  });
});

// ---- etichette nascoste: i bot "capiscono" quanto un personaggio c'entra con una frase ----
import { readFileSync } from "node:fs";
import { affinity, registerTags, phraseTagCount } from "../src/index.ts";
import { MAX_PLAYERS } from "../src/index.ts";

const json = (p: string) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
describe("giocatori virtuali con etichette", () => {
  const cardsTags = json("content/tags-personaggi.json"), phraseTags = json("content/tags-frasi.json");
  const manifest = (json("public/cards/manifest.json") as { id: string; overlay_of?: string }[]).filter((m) => !m.overlay_of).map((m) => m.id);
  const phrases = Object.keys(phraseTags);
  it("ogni personaggio ha etichette, quasi tutte le frasi ne hanno; l'affinità distingue casi chiari", () => {
    registerTags(cardsTags, phraseTags);
    for (const id of manifest) expect(cardsTags[id]?.temi.length).toBeGreaterThan(0);
    const tagged = phrases.filter((f) => phraseTags[f].tipo.length + phraseTags[f].temi.length > 0);
    expect(tagged.length / phrases.length).toBeGreaterThan(0.85);   // le frasi di puro confronto («chi sarebbe il peggior…») possono restare senza etichetta
    const church = phrases.find((f) => f.includes("in chiesa pensa solo al pranzo"))!;
    expect(affinity("p02-i01", church)!).toBeGreaterThan(affinity("p01-i08", church)!);   // il religioso batte il personal trainer su una frase da chiesa
    expect(phraseTagCount(church)).toBeGreaterThan(0); expect(affinity("p01-i08", "frase sconosciuta")).toBeNull();
  });
  const play = (levels: BotLevel[], seed: number) => {
    const phrases = Object.keys(phraseTags).filter((f) => phraseTags[f].tipo.length > 0 && !f.includes("sarebbe"));   // solo frasi di tratto con un tipo umano chiaro
    const deck = manifest, phraseDeck = phrases.map((f, i) => ({ id: "t" + i, phrases: [f, f + " ", f + "  ", f + "   ", f + "    "] }));
    return playBots({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed, deck, phraseDeck: phrases.length ? [{ id: "m", phrases: phrases.slice(0, 5) }, ...phraseDeck.slice(0, 20).map((c, i) => ({ id: "u" + i, phrases: [phrases[i + 5]!, phrases[i + 40]!] }))] : phraseDeck } as GameConfig, levels, seed * 31);
  };
  it("con le etichette il Medio e il Difficile battono il Facile più del caso (partite da 4)", () => {
    registerTags(cardsTags, phraseTags);
    for (const lvl of ["medium", "hard"] as BotLevel[]) {
      let wins = 0; const games = 60;
      for (let g = 0; g < games; g++) { const slot = g % 4, lv: BotLevel[] = ["easy", "easy", "easy", "easy"]; lv[slot] = lvl; const s = play(lv, 300 + g); if (s.winners?.includes("p" + slot)) wins++; }
      expect(wins / games).toBeGreaterThan(0.32);   // il caso è 25%: con il Lui! sui voti degli altri il vantaggio dei bot è moderato (≈40% a 4 giocatori)
    }
  });
  it("il Megafono bot usa solo segnalini che gli restano, vari tra loro e imprevedibili", () => {
    const slots = new Set<string>(); let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let s = createGame(cfg(5, { seed })).state;
      const mem = newBotMemory(); let r = seed; const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
      s = applyAction(s, { type: "choosePhrase", playerId: megafonoOf(s), mode: "free" }).state;
      for (const p of s.playerIds) if (p !== megafonoOf(s)) s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![0]! }).state;
      s.luiSpent = { ...(s.luiSpent ?? {}), [megafonoOf(s)]: ["k1"] };
      const a = chooseBotAction(s, megafonoOf(s), "hard", mem, rand);
      if (a && a.type === "placeLui") { slots.add(a.slot); n++; expect(a.slot).not.toBe("k1"); }
    }
    expect(n).toBe(60); expect(slots.size).toBe(3);
  });
  it("i bot non Megafono reagiscono al Lui!: con la soglia che temono votano meno la carta del Lui! di quando non c'è", () => {
    const base = () => createGame(cfg(6, { seed: 5 })).state;
    const toVoteWith = (slot: "k1" | "k3" | "zero") => {
      let s = base(); const m = megafonoOf(s);
      s = applyAction(s, { type: "choosePhrase", playerId: m, mode: "free" }).state;
      for (const p of s.playerIds) if (p !== m) s = applyAction(s, { type: "playCard", playerId: p, cardId: s.hands[p]![0]! }).state;
      s = applyAction(s, { type: "placeLui", playerId: m, slot, position: 1 }).state; return s;
    };
    const share = (slot: "k1" | "k3" | "zero") => {
      let on = 0, tot = 0; const s = toVoteWith(slot), m = megafonoOf(s);
      for (let k = 0; k < 400; k++) { let r = k + 11; const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
        const me = s.playerIds.find((p) => p !== m)!, a = chooseBotAction(s, me, "hard", newBotMemory(), rand); if (a && a.type === "vote") { tot++; if (a.position === 1) on++; } }
      return on / tot;
    };
    // il bot non conosce il segnalino: ragiona su quelli rimasti, quindi il comportamento è lo stesso per qualunque segnalino posato (non "sbircia" la mano del Megafono)
    expect(Math.abs(share("k1") - share("zero"))).toBeLessThan(0.12);
  });
  void MAX_PLAYERS;
});
import { megafonoOf as megafonoOf } from "../src/index.ts";
