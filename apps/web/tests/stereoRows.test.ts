import { describe, expect, it } from "vitest";
import { stereoGame, stereoGruppi, ruoloDi, fraseLuogo, trattoPlurale, accordaFemminile, aspettoDi } from "../src/lib/stereo.ts";

describe("pannello luoghi comuni: dati della partita", () => {
  it("somma i voti di tutti (nessun nome), dà la quota per caso e i luoghi comuni più presenti", () => {
    const g = stereoGame({ n: { a: 4, b: 4, c: 0 }, s: { a: 1, b: 3 }, c: 1.2, turni: 4, cause: { "politico → bugiardo": 3, "occhiali → saputello": 1, "tuta → vanitoso": 1 } }, 2)!;
    expect(g.pct).toBe(50); expect(g.caso).toBe(30); expect(g.n).toBe(8); expect(g.top).toEqual([{ k: "politico → bugiardo", n: 3, pct: 60, det: null }, { k: "occhiali → saputello", n: 1, pct: 20, det: null }]);
    expect(stereoGame(null)).toBeNull(); expect(stereoGame({ n: {}, s: {}, c: 0, turni: 0, cause: {} })).toBeNull();
  });

  it("umani contro bot e miglior lancio", () => {
    const st = { n: { a: 4, b: 4, c: 8 }, s: { a: 2, b: 2, c: 2 }, c: 1, turni: 4, cause: {}, lancio: { cardId: "x", causa: "politico → bugiardo", n: 5, text: "frase" } };
    expect(stereoGruppi(st, (id) => id === "c")).toEqual({ umani: 50, bot: 25 });
    expect(stereoGruppi(st, () => false)).toEqual({ umani: 38, bot: null });
    expect(stereoGame(st)!.lancio).toEqual({ cardId: "x", ruolo: "Politico", n: 5, text: "frase" }); expect(ruoloDi("occhiali → saputello")).toBe("Occhiali");
  });
  it("il luogo comune si legge come frase: ruolo («I politici sono bugiardi») o aspetto («Chi porta la cravatta è più bugiardo degli altri»), con il tratto accordato", () => {
    expect(fraseLuogo("politico → bugiardo")).toBe("I politici sono bugiardi");
    expect(fraseLuogo("reginetta → vanitoso")).toBe("Le reginette sono vanitose");
    expect(fraseLuogo("guardia → drammatico")).toBe("Le guardie sono drammatiche");
    expect(fraseLuogo("manager → egoista")).toBe("I manager sono egoisti");
    expect(fraseLuogo("@cravatta → bugiardo")).toBe("Chi porta la cravatta è più bugiardo degli altri");
    expect(fraseLuogo("sconosciuto → furbo")).toBe("sconosciuto → furbo");   // voce non nei testi: resta il nome grezzo
    expect(trattoPlurale("infedele", false)).toBe("infedeli"); expect(trattoPlurale("drammatico", false)).toBe("drammatici"); expect(trattoPlurale("nerd", false)).toBe("nerd");
    expect(ruoloDi("@occhiali_sole → arrogante")).toBe("Occhiali sole");
  });
  it("la classifica dei luoghi comuni è solo di ruolo; la caratteristica comune è l'aspetto presente in almeno metà dei voti (e almeno 2) dei luoghi con lo stesso tratto del primo", () => {
    const base = { n: { a: 4 }, s: { a: 2 }, c: 1, turni: 2 };
    const g = stereoGame({ ...base, cause: { "politico → bugiardo": 4, "giudice → bugiardo": 2, "@cravatta → bugiardo": 3, "cuoco → pigro": 1 }, asp: { "politico → bugiardo": { n: 4, l: { cravatta: 3, occhiali: 1 } }, "giudice → bugiardo": { n: 2, l: { cravatta: 2 } }, "cuoco → pigro": { n: 1, l: { cravatta: 1 } } } })!;
    expect(g.top.map((x) => x.k)).toEqual(["politico → bugiardo", "giudice → bugiardo", "cuoco → pigro"]);   // nessun «@…» in classifica
    expect(g.top[0]!.pct).toBe(57);                                                                     // 4 su 7 (il peso degli aspetti non conta)
    expect(g.comune).toEqual({ k: "@cravatta → bugiardo", pct: 83, n: 5, tot: 6 });                                    // 5 voti su 6 dei luoghi «bugiardo»; il cuoco (tratto diverso) non conta
    expect(stereoGame({ ...base, cause: { "politico → bugiardo": 4 }, asp: { "politico → bugiardo": { n: 4, l: { cravatta: 1, occhiali: 1 } } } })!.comune).toBeNull();   // nessun aspetto in comune
  });
  it("i dettagli: da dove viene il peso, le carte coinvolte e quanto è solida la stima", () => {
    const g = stereoGame({ n: { a: 4 }, s: { a: 2 }, c: 1, turni: 2, cause: { "politico → bugiardo": 5, "giudice → bugiardo": 2 }, det: { "politico → bugiardo": { v: 3, m: 1.5, e: 0.5, c: { c1: 2, c2: 1 } }, "giudice → bugiardo": { v: 1, m: 0, e: 1, c: { c3: 1 } } } })!;
    expect(g.top[0]!.det).toEqual({ v: 3, m: 1.5, e: 0.5, c: { c1: 2, c2: 1 } }); expect(g.votiLuoghi).toBe(4);
  });
  it("il luogo comune con l'accusa della frase: «I manager non prendono mai niente sul serio»; al femminile si accorda; l'aspetto comune si legge «chi porta…»", () => {
    expect(fraseLuogo("influencer → non prendono mai niente sul serio")).toBe("Gli influencer non prendono mai niente sul serio");
    expect(fraseLuogo("manager → sono i più bugiardi")).toBe("I manager sono i più bugiardi");
    expect(fraseLuogo("reginetta → sono i più simpatici")).toBe("Le reginette sono le più simpatiche");
    expect(fraseLuogo("guardia → sono convinti di essere insostituibili")).toBe("Le guardie sono convinte di essere insostituibili");
    expect(accordaFemminile("sono i più teatrali e sono convinti di essere più furbi")).toBe("sono le più teatrali e sono convinte di essere più furbe");
    expect(aspettoDi("@cravatta → sono i più bugiardi")).toBe("chi porta la cravatta");
  });
});
