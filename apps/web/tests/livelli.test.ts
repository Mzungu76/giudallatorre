import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyDb } from "../src/lib/stats.ts";
import { ART } from "../src/components/GameIcon.tsx";
import { ICONS, MAX_LEVEL, XP, levelFor, tierOf, xpFor, xpOf } from "../src/lib/livelli.ts";

const testi = JSON.parse(readFileSync(join(import.meta.dirname, "../../../public/testi.json"), "utf8")).testi as Record<string, { t: string }>;

describe("livelli del giocatore", () => {
  it("50 livelli, ognuno con icona (tutte diverse) e titolo nei testi", () => {
    expect(MAX_LEVEL).toBe(50); expect(ICONS).toHaveLength(50); expect(new Set(ICONS).size).toBe(50); for (const n of ICONS) expect(ART[n], `icona ${n}`).toBeTruthy();
    for (let n = 1; n <= 50; n++) expect(testi[`lv.${n}`]?.t.length, `lv.${n}`).toBeGreaterThan(2);
    expect(new Set(Array.from({ length: 50 }, (_, i) => testi[`lv.${i + 1}`]!.t)).size).toBe(50);
  });
  it("progressione non lineare: le soglie crescono e ogni salto è (quasi) più grande del precedente", () => {
    expect(xpFor(1)).toBe(0); expect(xpFor(2)).toBe(40);
    let prevGap = 0;
    for (let n = 2; n <= 50; n++) { const gap = xpFor(n) - xpFor(n - 1); expect(gap, `salto al livello ${n}`).toBeGreaterThanOrEqual(prevGap - 10); prevGap = gap; }   // soglie arrotondate a 10 XP: tolleranza di un arrotondamento
    const gap = (n: number) => xpFor(n) - xpFor(n - 1); expect(gap(10)).toBeGreaterThan(gap(5)); expect(gap(25)).toBeGreaterThan(gap(10)); expect(gap(50)).toBeGreaterThan(gap(25));
    expect(xpFor(50)).toBeGreaterThan(13000); expect(xpFor(50)).toBeLessThan(15000);
    expect(xpFor(50) - xpFor(49)).toBeGreaterThan(8 * (xpFor(2) - xpFor(1)));   // l'ultimo livello costa molto più del primo
  });
  it("livello dall'esperienza: soglie esatte, tetto a 50, avanzamento tra un livello e l'altro", () => {
    expect(levelFor(0).level).toBe(1); expect(levelFor(39).level).toBe(1); expect(levelFor(40).level).toBe(2);
    expect(levelFor(xpFor(50)).level).toBe(50); expect(levelFor(10 ** 7)).toMatchObject({ level: 50, progress: 1, toNext: 0, to: null });
    const m = levelFor(xpFor(10) + 10); expect(m.level).toBe(10); expect(m.progress).toBeGreaterThan(0); expect(m.progress).toBeLessThan(1); expect(m.toNext).toBe(xpFor(11) - xpFor(10) - 10);
    expect(tierOf(1)).toBe(0); expect(tierOf(10)).toBe(0); expect(tierOf(11)).toBe(1); expect(tierOf(50)).toBe(4);
  });
  it("esperienza dai contatori: una partita vinta vale circa 100 XP, e senza gioco non c'è esperienza", () => {
    const db = emptyDb(1); expect(xpOf(db.totals)).toBe(0);
    const T = db.totals; T.games = 1; T.wins = 1; T.podiums = 1; T.points = 12; T.votes = 4; T.voteHits = 2; T.megaTurns = 2; T.cadeHit = 1; T.minis = 1; T.miniHits = 1;
    expect(xpOf(T)).toBe(XP.game + XP.win + XP.podium + 12 + 4 + 2 * XP.voteHit + 2 * XP.mega + XP.tokenHit + XP.mini + XP.miniHit);
    expect(levelFor(xpOf(T)).level).toBeGreaterThanOrEqual(3);
  });
});
