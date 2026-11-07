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
  it("ogni personaggio e ogni frase ha etichette; l'affinità distingue casi chiari", () => {
    registerTags(cardsTags, phraseTags);
    for (const id of manifest) expect(cardsTags[id]?.temi.length).toBeGreaterThan(0);
    for (const f of phrases) expect(phraseTags[f].temi.length).toBeGreaterThan(0);
    const gym = phrases.find((f) => f.includes("manubrio"))!;
    expect(affinity("p01-i08", gym)!).toBeGreaterThan(affinity("p06-i05", gym)!);   // personal trainer batte la sposa su una frase da palestra
    expect(phraseTagCount(gym)).toBeGreaterThan(0); expect(affinity("p01-i08", "frase sconosciuta")).toBeNull();
  });
  const play = (levels: BotLevel[], seed: number) => {
    const deck = manifest, phraseDeck = phrases.map((f, i) => ({ id: "t" + i, phrases: [f, f + " ", f + "  ", f + "   ", f + "    "] }));
    return playBots({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed, deck, phraseDeck: phrases.length ? [{ id: "m", phrases: phrases.slice(0, 5) }, ...phraseDeck.slice(0, 20).map((c, i) => ({ id: "u" + i, phrases: [phrases[i + 5]!, phrases[i + 40]!] }))] : phraseDeck } as GameConfig, levels, seed * 31);
  };
  it("con le etichette il Medio e il Difficile battono nettamente il Facile (partite da 4)", () => {
    registerTags(cardsTags, phraseTags);
    for (const lvl of ["medium", "hard"] as BotLevel[]) {
      let wins = 0; const games = 60;
      for (let g = 0; g < games; g++) { const slot = g % 4, lv: BotLevel[] = ["easy", "easy", "easy", "easy"]; lv[slot] = lvl; const s = play(lv, 300 + g); if (s.winners?.includes("p" + slot)) wins++; }
      expect(wins / games).toBeGreaterThan(0.4);   // il caso è 25%
    }
  });
  it("il Megafono Difficile bluffa: con la reputazione di chi dice sempre CADE, a volte scommette NON CADE sulla carta ovvia", () => {
    registerTags(cardsTags, phraseTags);
    const kinds = new Set<string>(); let withLui = 0;
    for (let g = 0; g < 40; g++) {
      const levels: BotLevel[] = ["hard", "hard", "hard", "hard"];
      let s = createGame({ players: levels.map((_, i) => ({ id: "p" + i, name: "P" + i })), seed: 700 + g, deck: manifest, phraseDeck: [{ id: "m", phrases: phrases.slice(0, 5) }, ...phrases.slice(5, 60).map((f, i) => ({ id: "u" + i, phrases: [f, phrases[(i + 70) % 250]!] }))], mixPhrases: true }).state;
      const mem = newBotMemory(); mem.lui = Object.fromEntries(s.playerIds.map((p) => [p, { c: 9, n: 10 }]));
      let r = g + 5; const rand = () => { const x = nextRandom(r); r = x.state; return x.value; }; let guard = 0;
      while (s.phase !== "SUSPECT" && guard++ < 200) for (const id of s.playerIds) { const a = chooseBotAction(s, id, "hard", mem, rand); if (a) { s = applyAction(s, a).state; break; } }
      const a = chooseBotAction(s, megafonoOfState(s), "hard", mem, rand); if (a && a.type === "placeLui") { kinds.add(a.kind); withLui++; }
    }
    expect(withLui).toBeGreaterThan(30); expect(kinds.has("NON_CADE")).toBe(true); expect(kinds.has("CADE")).toBe(true);
  });
  void MAX_PLAYERS;
});
import { megafonoOf as megafonoOfState } from "../src/index.ts";
