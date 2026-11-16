import { describe, expect, it } from "vitest";
import { stereoGame, stereoGruppi, ruoloDi } from "../src/lib/stereo.ts";

describe("pannello luoghi comuni: dati della partita", () => {
  it("somma i voti di tutti (nessun nome), dà la quota per caso e i luoghi comuni più presenti", () => {
    const g = stereoGame({ n: { a: 4, b: 4, c: 0 }, s: { a: 1, b: 3 }, c: 1.2, turni: 4, cause: { "politico → bugiardo": 3, "occhiali → saputello": 1, "tuta → vanitoso": 1 } }, 2)!;
    expect(g.pct).toBe(50); expect(g.caso).toBe(30); expect(g.n).toBe(8); expect(g.top).toEqual([{ k: "politico → bugiardo", n: 3 }, { k: "occhiali → saputello", n: 1 }]);
    expect(stereoGame(null)).toBeNull(); expect(stereoGame({ n: {}, s: {}, c: 0, turni: 0, cause: {} })).toBeNull();
  });

  it("umani contro bot e miglior lancio", () => {
    const st = { n: { a: 4, b: 4, c: 8 }, s: { a: 2, b: 2, c: 2 }, c: 1, turni: 4, cause: {}, lancio: { cardId: "x", causa: "politico → bugiardo", n: 5, text: "frase" } };
    expect(stereoGruppi(st, (id) => id === "c")).toEqual({ umani: 50, bot: 25 });
    expect(stereoGruppi(st, () => false)).toEqual({ umani: 38, bot: null });
    expect(stereoGame(st)!.lancio).toEqual({ cardId: "x", ruolo: "Politico", n: 5, text: "frase" }); expect(ruoloDi("occhiali → saputello")).toBe("Occhiali");
  });
});
