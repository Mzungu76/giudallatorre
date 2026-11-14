import { describe, expect, it } from "vitest";
import { BOT_STYLES, chooseBotAction, megafonoOf, newBotMemory, styleById } from "../src/index.ts";
import { typeBelief } from "../src/ai.ts";
import type { BotLevel, GameState } from "../src/index.ts";
import { act, start, toSuspect } from "./helpers.ts";

const rng = (seed: number) => { let r = (seed * 104729) % 2147483647 || 1; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

describe("caratteri dei bot", () => {
  it("dodici caratteri distinti, tutti con valori tra 0 e 1; id sconosciuto → neutro", () => {
    expect(new Set(BOT_STYLES.map((x) => x.id)).size).toBe(12);
    for (const st of BOT_STYLES) for (const k of ["conf", "herd", "bluff", "susp", "risk", "speed"] as const) { expect(st[k]).toBeGreaterThanOrEqual(0); expect(st[k]).toBeLessThanOrEqual(1); }
    expect(styleById("boh").id).toBe("neutro");
  });
});

describe("leggere i bluff", () => {
  it("chi legge bene crede che il Megafono scelga bene; chi è ingenuo (profondità 0) non distingue; il sospettoso è meno sicuro", () => {
    const ev = (t: string) => (t === "cade" ? 3 : 0);
    const hard = typeBelief(ev, 0.3, 0.4, 1), naive = typeBelief(ev, 0.3, 0.4, 0), suspicious = typeBelief(ev, 0.3, 1, 1);
    expect(hard[0]).toBeGreaterThan(0.95); expect(naive.every((x) => Math.abs(x - 1 / 3) < 1e-9)).toBe(true);
    expect(suspicious[0]!).toBeLessThan(hard[0]!); expect(suspicious[0]!).toBeGreaterThan(1 / 3);
    for (const b of [hard, naive, suspicious]) expect(b.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 9);
  });
});

describe("bluff del Megafono", () => {
  const s0: GameState = toSuspect(start(5, { seed: 11 }));
  const mega = megafonoOf(s0);
  const modal = (lvl: BotLevel, bluff: number, n = 250) => {
    const c: Record<string, number> = {};
    for (let k = 1; k <= n; k++) { const a = chooseBotAction(s0, mega, lvl, newBotMemory(), rng(k), { ...styleById("neutro"), bluff }); if (a?.type === "placeMarks") { const key = `${a.marks[0]!.slot}@${a.marks[0]!.position}`; c[key] = (c[key] ?? 0) + 1; } }
    return Math.max(...Object.values(c)) / n;
  };
  it("un bluffatore difficile è meno prevedibile di uno che non bluffa mai", () => {
    expect(modal("hard", 1)).toBeLessThan(modal("hard", 0) - 0.03);
  });
  it("il livello facile non bluffa: il carattere non cambia la scelta", () => {
    expect(Math.abs(modal("easy", 1) - modal("easy", 0))).toBeLessThan(0.12);
  });
  it("le azioni sono sempre legali con ogni carattere e livello", () => {
    for (const lvl of ["easy", "medium", "hard"] as BotLevel[]) for (const st of BOT_STYLES) for (let k = 1; k <= 4; k++) {
      const a = chooseBotAction(s0, mega, lvl, newBotMemory(), rng(k * 31), st)!; expect(a.type).toBe("placeMarks");
      const v = act(s0, a); expect(v.phase).toBe("VOTE");
      for (const p of v.playerIds) { const x = chooseBotAction(v, p, lvl, newBotMemory(), rng(k * 7), st); expect(x?.type).toBe("vote"); act(v, x!); }
    }
  });
});
