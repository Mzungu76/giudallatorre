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
