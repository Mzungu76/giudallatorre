import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AGE_BANDS, applyAction, buildPhraseDeck, createGame, fullPhrase, megafonoOf, parseAge, PHRASE_FAMILIES, PHRASES_PER_CARD, simulateGame } from "../src/index.ts";
import type { AgeBand, PoolConfession, PoolPhrase } from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const rawPhrases = json("content/frasi-megafono.json").frasi as { id: string; testo: string; verbo: string; famiglia: string; eta: string; stato: string }[];
const rawConf = json("content/confessioni.json").confessioni as { id: string; testo: string; eta: string; stato: string }[];
const pool: PoolPhrase[] = rawPhrases.map((f) => ({ id: f.id, text: f.testo, verb: f.verbo as "sale", family: f.famiglia as "etichetta", age: parseAge(f.eta) }));
const confessions: PoolConfession[] = rawConf.map((c) => ({ id: c.id, text: c.testo, age: parseAge(c.eta) }));
const manifest = json("public/cards/manifest.json") as { id: string; overlay_of?: string }[];
const deck = manifest.filter((m) => !m.overlay_of).map((m) => m.id);

describe("contenuti del gioco", () => {
  it("120 carte Personaggio (125 immagini, 5 sono livelli sovrapposti) con identificativi univoci", () => {
    expect(deck).toHaveLength(120); expect(new Set(deck).size).toBe(120);
  });
  it("riserva di frasi: identificativi e testi univoci, famiglia, verbo ed età validi", () => {
    expect(rawPhrases.length).toBeGreaterThanOrEqual(400);
    expect(new Set(rawPhrases.map((f) => f.id)).size).toBe(rawPhrases.length);
    expect(new Set(rawPhrases.map((f) => f.testo.toLowerCase())).size).toBe(rawPhrases.length);
    for (const f of rawPhrases) {
      expect(PHRASE_FAMILIES).toContain(f.famiglia);
      expect(AGE_BANDS).toContain(parseAge(f.eta));
      expect(f.testo.endsWith(".")).toBe(true);
      expect(f.testo.length).toBeLessThanOrEqual(80);   // si legge ad alta voce e sta in poche righe
      // «sale» col singolare, «salgono» col plurale (i più…, quelli che…)
      const plural = /^(i più|quelli che)(?=\s)/.test(f.testo);
      expect(f.verbo).toBe(plural ? "salgono" : "sale");
      expect(/^(i più|quelli che|chi|il più)(?=[\s,])/.test(f.testo)).toBe(true);
      expect(fullPhrase({ verb: f.verbo as "sale", text: f.testo })).toMatch(/^Oggi (sale|salgono) sulla torre /);
    }
  });
  it("ogni fascia d'età ha frasi in tutte le famiglie (anche i 6+ e i 18+)", () => {
    for (const a of AGE_BANDS) for (const fam of PHRASE_FAMILIES) expect(pool.some((p) => p.age === a && p.family === fam) || a === 6 && fam === "convinzione", `${a}+ ${fam}`).toBe(true);
    for (const a of AGE_BANDS) expect(pool.filter((p) => p.age === a).length).toBeGreaterThanOrEqual(30);
  });
  it("confessioni: «Ammetto…», univoche, in forma neutra rispetto al genere, almeno 60 voci", () => {
    expect(rawConf.length).toBeGreaterThanOrEqual(60);
    expect(new Set(rawConf.map((c) => c.id)).size).toBe(rawConf.length);
    expect(new Set(rawConf.map((c) => c.testo)).size).toBe(rawConf.length);
    for (const c of rawConf) {
      expect(c.testo.startsWith("Ammetto") && c.testo.endsWith(".")).toBe(true);
      expect(c.testo, c.id).not.toMatch(/\b(sono stat[oa]|essermi \w+[oa]\b|rimast[oa]|pentit[oa]|con lui|con lei|cugino|cugina|infiltrat[oa]|abbuffat[oa])/i);
      expect(AGE_BANDS).toContain(parseAge(c.eta));
    }
    for (const a of AGE_BANDS) expect(confessions.some((c) => c.age === a), `confessioni ${a}+`).toBe(true);
  });
});

describe("costruzione del mazzo frasi", () => {
  const build = (age: AgeBand, seed = 7, extra = {}) => buildPhraseDeck(pool, confessions, { age, seed, ...extra });
  const poolBySentence = new Map(pool.map((p) => [fullPhrase(p), p]));
  const conf = new Map(confessions.map((c) => [c.text, c]));

  it("è deterministico per seme e cambia con un altro seme", () => {
    expect(build(14, 1)).toEqual(build(14, 1));
    expect(build(14, 1)).not.toEqual(build(14, 2));
  });
  it("rispetta la fascia d'età: nessuna frase o confessione sopra l'età del gruppo", () => {
    for (const a of AGE_BANDS) for (const c of build(a)) for (const t of c.phrases) {
      const age = poolBySentence.get(t)?.age ?? conf.get(t)?.age;
      expect(age, t).toBeDefined(); expect(age!, `${a}+: «${t}»`).toBeLessThanOrEqual(a);
    }
  });
  it("ogni carta ha 3 frasi di famiglie diverse, senza ripetizioni nel mazzo", () => {
    const d = build(14).filter((c) => c.phrases.length > 1), all = d.flatMap((c) => c.phrases);
    expect(d.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all).size).toBe(all.length);
    for (const c of d) { expect(c.phrases).toHaveLength(PHRASES_PER_CARD); expect(new Set(c.phrases.map((t) => poolBySentence.get(t)!.family)).size).toBe(PHRASES_PER_CARD); }
  });
  it("pesca pesata: almeno 2 frasi su 3 vengono dalle due fasce più alte consentite", () => {
    for (const [a, lo] of [[14, 10], [18, 14], [10, 6]] as [AgeBand, AgeBand][]) {
      for (const c of build(a).filter((x) => x.phrases.length > 1)) {
        const hi = c.phrases.filter((t) => poolBySentence.get(t)!.age >= lo).length;
        expect(hi, `${a}+`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it("le confessioni sono circa il 15% delle carte, una frase sola ciascuna; si possono escludere", () => {
    const d = build(14), singles = d.filter((c) => c.phrases.length === 1);
    expect(singles.length / d.length).toBeGreaterThan(0.1); expect(singles.length / d.length).toBeLessThan(0.2);
    expect(singles.every((c) => c.phrases[0]!.startsWith("Ammetto"))).toBe(true);
    expect(build(14, 7, { confessions: false }).every((c) => c.phrases.length === PHRASES_PER_CARD)).toBe(true);
  });
  it("il mazzo è abbastanza grande per ogni fascia (più dei turni possibili senza spareggio)", () => {
    for (const a of AGE_BANDS) expect(build(a).length, `${a}+`).toBeGreaterThanOrEqual(a === 6 ? 25 : 30);
  });
  it("una partita completa con i contenuti reali per ogni fascia (8 giocatori, variante Megafono sa)", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `G${i + 1}` }));
    for (const a of AGE_BANDS) {
      const { state, problems } = simulateGame({ players, seed: 2026, deck, phraseDeck: build(a, 99) }, 77, { checkEveryStep: true });
      expect(problems).toEqual([]); expect(state.phase).toBe("GAME_OVER");
    }
  });
});

describe("confessione: la frase mostrata a tutti nomina il Megafono", () => {
  it("la carta del Megafono è in prima persona, quella proclamata dice «Nome ammette…»", () => {
    const players = Array.from({ length: 3 }, (_, i) => ({ id: `p${i + 1}`, name: ["Marta", "Luca", "Sara"][i]! }));
    const phraseDeck = [{ id: "c1", phrases: ["Ammetto di aver pianto davanti a uno dei personaggi sopra la Torre."] }];
    let s = createGame({ players, seed: 5, deck, phraseDeck, firstMegafonoIndex: 1 }).state;
    expect(s.proclaim!.phrases[0]).toMatch(/^Ammetto di aver pianto/);
    s = applyAction(s, { type: "choosePhrase", playerId: megafonoOf(s), mode: "card", index: 0 }).state;
    expect(s.phrase).toMatchObject({ mode: "card", text: "Luca ammette di aver pianto davanti a uno dei personaggi sopra la Torre." });
  });
  it("le frasi normali restano invariate", () => {
    const players = Array.from({ length: 3 }, (_, i) => ({ id: `p${i + 1}`, name: `G${i + 1}` }));
    const phraseDeck = [{ id: "m1", phrases: ["Oggi sale sulla torre chi sarebbe il peggior coinquilino."] }];
    let s = createGame({ players, seed: 5, deck, phraseDeck }).state;
    s = applyAction(s, { type: "choosePhrase", playerId: megafonoOf(s), mode: "card", index: 0 }).state;
    expect(s.phrase).toMatchObject({ text: "Oggi sale sulla torre chi sarebbe il peggior coinquilino." });
  });
});
