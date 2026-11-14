import { it } from "vitest";
import { applyAction, buildPhraseDeck, chooseBotAction, createGame, learnFromResult, TUNE, newBotMemory, DEFAULT_AGE_BAND, BOT_STYLES } from "@gdt/game-engine";
import type { BotLevel, BotStyle, GameState } from "@gdt/game-engine";
import { CONFESSIONS, DECK, PHRASE_POOL } from "../src/content.ts";

/**
 * Taratura dei bot (a mano: TARA=1 npx vitest run worker/tests/taratura.test.ts). Partite complete tra bot con i contenuti veri;
 * i posti si rimescolano a ogni partita per togliere il vantaggio di chi gioca per primo. Stampa i punti medi per livello e per stile.
 */
export function playBots(levels: BotLevel[], styles: (BotStyle | undefined)[], seed: number): number[] {
  let r = seed | 0; const rand = () => { r = (Math.imul(r, 1664525) + 1013904223) | 0; return ((r >>> 0) % 1e9) / 1e9; };
  const players = levels.map((_, i) => ({ id: `p${i}`, name: `B${i}` }));
  const phraseDeck = buildPhraseDeck(PHRASE_POOL!, CONFESSIONS, { age: DEFAULT_AGE_BAND, seed: seed ^ 0x5bd1e995, confessions: true });
  let s: GameState = createGame({ players, seed, cnc: true, mixPhrases: false, deck: DECK, phraseDeck, miniGame: "random", accuseDeck: [] }).state;
  const mem = newBotMemory(); let guard = 0;
  while (s.phase !== "GAME_OVER" && guard++ < 8000) {
    if (s.phase === "RESULTS" || s.phase === "MINI_RESULTS") { if (s.phase === "RESULTS" && s.lastResult) learnFromResult(mem, s.tower, s.lastResult); s = applyAction(s, { type: "advance" }).state; continue; }
    let acted = false;
    for (let i = 0; i < players.length; i++) { const a = chooseBotAction(s, `p${i}`, levels[i]!, mem, rand, styles[i]); if (a) { s = applyAction(s, a).state; acted = true; break; } }
    if (!acted) { if (s.phase === "MINI_RUN") { s = applyAction(s, { type: "endRun" } as never).state; continue; } break; }
  }
  return s.playerIds.map((p) => s.scores[p] ?? 0);
}

const N = Number(process.env.TARA_N ?? 150);
for (const [k, v] of Object.entries(process.env)) if (k.startsWith("TUNE_")) (TUNE as Record<string, number>)[k.slice(5)] = Number(v);   // es. TUNE_easyLapse=0.9
it.skipIf(!process.env.TARA)("taratura dei livelli", () => {
  const only = process.env.TARA_CFG?.split(",").map(Number);
  const cfgs: [string, BotLevel[]][] = [["2 easy + 2 hard", ["easy", "easy", "hard", "hard"]], ["3 easy + 3 hard", ["easy", "easy", "easy", "hard", "hard", "hard"]], ["2 medium + 2 hard", ["medium", "medium", "hard", "hard"]], ["2 easy + 2 medium", ["easy", "easy", "medium", "medium"]], ["1 easy + 3 hard", ["easy", "hard", "hard", "hard"]]];
  for (const [name, lv] of cfgs.filter((_, i) => !only || only.includes(i))) {
    const tot: Record<string, number> = {}, cnt: Record<string, number> = {}, win: Record<string, number> = {};
    for (let k = 1; k <= N; k++) {
      const order = lv.map((_, i) => i).sort((a, b) => Math.sin(k * 12.9898 + a * 78.233) - Math.sin(k * 12.9898 + b * 78.233)), seat = order.map((i) => lv[i]!);
      const styles = seat.map((_, i) => BOT_STYLES[(k * 7 + i * 3) % BOT_STYLES.length]);
      const sc = playBots(seat, styles, k * 97 + 5);
      { const mx = Math.max(...sc), w = sc.filter((x) => x === mx).length; sc.forEach((x, i) => { if (x === mx) win[seat[i]!] = (win[seat[i]!] ?? 0) + 1 / w; }); }
      sc.forEach((x, i) => { tot[seat[i]!] = (tot[seat[i]!] ?? 0) + x; cnt[seat[i]!] = (cnt[seat[i]!] ?? 0) + 1; });
    }
    const m = Object.fromEntries(Object.keys(tot).map((l) => [l, tot[l]! / cnt[l]!]));
    console.log("TARA", name.padEnd(18), Object.entries(m).map(([l, v]) => `${l} ${v.toFixed(1)} (${Math.round((100 * (win[l] ?? 0)) / cnt[l]! * lv.filter((q) => q === l).length)}% vitt. di livello)`).join(" | "), m.easy && m.hard ? `| easy/hard ${(m.easy / m.hard).toFixed(2)}` : "", m.medium && m.hard ? `| medium/hard ${(m.medium / m.hard).toFixed(2)}` : "");
  }
}, 900000);

it.skipIf(!process.env.TARA_STYLE)("quanto valgono i caratteri (tutti difficili, caratteri a caso)", () => {
  const tot: Record<string, number> = {}, cnt: Record<string, number> = {};
  for (let k = 1; k <= N * 2; k++) {
    const ids = Array.from({ length: 6 }, (_, i) => BOT_STYLES[(Math.floor(Math.abs(Math.sin(k * 3.1 + i * 7.7)) * 1e4) + i * 5) % BOT_STYLES.length]!);
    const uniq = ids.filter((st, i) => ids.indexOf(st) === i); if (uniq.length < 6) continue;
    const sc = playBots(Array(6).fill("hard"), ids, k * 53 + 9);
    sc.forEach((x, i) => { tot[ids[i]!.id] = (tot[ids[i]!.id] ?? 0) + x; cnt[ids[i]!.id] = (cnt[ids[i]!.id] ?? 0) + 1; });
  }
  console.log("STILI", Object.keys(tot).map((id) => `${id} ${(tot[id]! / cnt[id]!).toFixed(1)}(${cnt[id]})`).join(" | "));
}, 900000);
