import { describe, expect, it } from "vitest";
import { act, castVotes, cfg, posOf, start, toSuspect } from "./helpers.ts";
import { chooseBotAction, createGame, luiTokens, newBotMemory, objectivePool, viewFor } from "../src/index.ts";
import type { GameState, Objective } from "../src/index.ts";

/** Variante PROPAGANDA: 6 segnalini (3 positivi, 3 negativi) che manipolano il conteggio; facoltativi gli obiettivi contrapposti. */
const P = (n: number, slots: string[], extra = {}) => toSuspect(start(n, { propaganda: true, luiSlots: slots, ...extra }));
const place = (g: GameState, slot: string, position: number, to?: number) => act(g, { type: "placeLui", playerId: "p1", slot, position, ...(to ? { to } : {}) });
// posizioni comode: in base (4 giocatori) la Torre ha le carte di p2, p3, p4 e quella del mazzo
const pos = (g: GameState) => ({ a: posOf(g, "p2"), b: posOf(g, "p3"), c: posOf(g, "p4"), d: posOf(g, null) });

describe("PROPAGANDA: segnalini", () => {
  it("a ogni partita 1 positivo e 1 negativo a caso, uguali per tutti; senza PROPAGANDA nessun segnalino di manipolazione", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame({ ...cfg(5, { seed, propaganda: true }), luiSlots: undefined }).state, set = luiTokens(g);
      expect(set).toHaveLength(2); expect(set[0]!.positive).toBe(true); expect(set[1]!.positive).toBe(false);
      expect(viewFor(g, "p2").luiTokens).toEqual(viewFor(g, "p4").luiTokens); expect(viewFor(g, "p2").propaganda).toBe(true);
      seen.add(set.map((x) => x.effect).join("+"));
    }
    expect(seen.size).toBe(9);                                           // tutte le 3 × 3 combinazioni
    expect(luiTokens(createGame({ ...cfg(5), luiSlots: undefined }).state).some((x) => x.effect)).toBe(false);
    // PROPAGANDA esclude «Il gregge»
    const g = createGame({ ...cfg(4, { propaganda: true, gregge: true }), luiSlots: undefined }).state;
    expect(g.gregge).toBe(false); expect(luiTokens(g).some((x) => x.trap || x.herd)).toBe(false);
  });

  it("Propaganda!: +1 voto con 3-4 giocatori, +2 con 5-8", () => {
    let g = P(4, ["pr", "im"]); const { a, b } = pos(g);
    expect(luiTokens(g).find((x) => x.slot === "pr")!.k).toBe(1);
    let r = castVotes(place(g, "pr", a), { p1: b, p2: a, p3: b, p4: a }).lastResult!;   // 2-2, la Propaganda porta a a 3
    expect(r.counts).toMatchObject({ [a]: 3, [b]: 2 }); expect(r.fallenPositions).toEqual([a]); expect(r.tie).toBe(false);
    expect(r.lui).toMatchObject({ effect: "propaganda", hit: true, before: 2, after: 3 });
    expect(r.points.p1).toBe(0);                                         // il segnalino non dà punti da solo; il Megafono ha votato b
    g = P(5, ["pr", "im"]);
    expect(luiTokens(g).find((x) => x.slot === "pr")!.k).toBe(2);
  });

  it("Spareggio!: nel pareggio in testa la sua carta cade da sola, anche contro il voto del Megafono; senza pareggio non fa nulla", () => {
    const g = P(4, ["sp", "im"]); const { a, b, c } = pos(g);
    let r = castVotes(place(g, "sp", a), { p1: b, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.tie).toBe(true); expect(r.spareggio).toBe(true); expect(r.tieBreak).toBe(false); expect(r.fallenPositions).toEqual([a]);
    expect(r.points.p2).toBe(2 + 2); expect(r.points.p1).toBe(0);         // p2 ha votato a (e a è la sua carta)
    r = castVotes(place(g, "sp", c), { p1: b, p2: a, p3: b, p4: a }).lastResult!;   // c non è in pareggio: regola normale (decide il Megafono)
    expect(r.spareggio).toBe(false); expect(r.tieBreak).toBe(true); expect(r.fallenPositions).toEqual([b]); expect(r.lui!.hit).toBe(false);
  });

  it("Influenza!: il voto del Megafono vale doppio, qualunque carta voti e ovunque sia posato il segnalino", () => {
    const g = P(4, ["in", "im"]); const { a, b, c, d } = pos(g);
    const r = castVotes(place(g, "in", d), { p1: b, p2: a, p3: a, p4: c }).lastResult!;
    expect(r.counts).toMatchObject({ [a]: 2, [b]: 2, [c]: 1 }); expect(r.tie).toBe(true); expect(r.tieBreak).toBe(true); expect(r.fallenPositions).toEqual([b]);
    const r2 = castVotes(place(g, "in", d), { p1: b, p2: a, p3: c, p4: d }).lastResult!;
    expect(r2.counts[b]).toBe(2); expect(r2.fallenPositions).toEqual([b]); expect(r2.tie).toBe(false);
  });

  it("Imbroglio!: annulla tutti i voti della carta (anche quello del Megafono, che qui può votarla); chi l'ha votata non prende il +2", () => {
    const g = P(4, ["pr", "im"]); const { a, b } = pos(g);
    const r = castVotes(place(g, "im", a), { p1: a, p2: a, p3: a, p4: b }).lastResult!;
    expect(r.counts).toEqual({ [b]: 1 }); expect(r.fallenPositions).toEqual([b]);
    expect(r.lui).toMatchObject({ effect: "imbroglio", hit: true, caught: ["p1", "p2", "p3"] });
    expect(r.points).toEqual({ p1: 0, p2: 0, p3: 2, p4: 2 });           // p3: carta caduta; p4: voto giusto
  });

  it("Dirottamento!: sposta un voto sulla carta scelta dal Megafono; senza voti non fa nulla; serve un'altra carta di arrivo", () => {
    const g = P(4, ["pr", "di"]); const { a, b, c } = pos(g);
    expect(() => place(g, "di", a)).toThrow(/riceve il voto/);
    expect(() => place(g, "di", a, a)).toThrow(/altra carta/);
    expect(viewFor(place(g, "di", a, b), "p1").luiTo).toBe(b); expect(viewFor(place(g, "di", a, b), "p2").luiTo).toBeNull();
    let r = castVotes(place(g, "di", a, b), { p1: a, p2: a, p3: b, p4: c }).lastResult!;   // a 2 → 1, b 1 → 2
    expect(r.counts).toMatchObject({ [a]: 1, [b]: 2 }); expect(r.fallenPositions).toEqual([b]); expect(r.lui).toMatchObject({ to: b, before: 2, after: 1, hit: true });
    expect(r.points.p3).toBe(2 + 2);                                     // p3 ha votato b, che è anche la sua carta
    r = castVotes(place(g, "di", c, b), { p1: a, p2: a, p3: b, p4: a }).lastResult!;
    expect(r.lui!.hit).toBe(false); expect(r.fallenPositions).toEqual([a]);
  });

  it("Censura!: toglie un voto alla carta (se ne ha)", () => {
    const g = P(4, ["pr", "ce"]); const { a, b } = pos(g);
    const r = castVotes(place(g, "ce", a), { p1: b, p2: a, p3: a, p4: b }).lastResult!;
    expect(r.counts).toMatchObject({ [a]: 1, [b]: 2 }); expect(r.fallenPositions).toEqual([b]); expect(r.lui).toMatchObject({ before: 2, after: 1 });
  });

  it("i voti annullati di tutti non bloccano il gioco: se nessuna carta ha voti decide il voto del Megafono", () => {
    const g = P(3, ["pr", "im"]), a = g.tower[0]!.position;
    const r = castVotes(place(g, "im", a), { p1: a, p2: a, p3: a }).lastResult!;
    expect(r.counts).toEqual({}); expect(r.fallenPositions).toEqual([a]);
    expect(Object.values(r.points).every((x) => x >= 0)).toBe(true);
  });
});

describe("PROPAGANDA: obiettivi contrapposti", () => {
  it("solo con l'opzione: alla Torre il Megafono riceve un obiettivo; gli altri vedono la condizione ma non il personaggio, fino ai risultati", () => {
    expect(P(4, ["pr", "im"]).objective ?? null).toBeNull();
    const g = P(4, ["pr", "im"], { objectives: true });
    expect(g.objective).toBeTruthy(); expect(g.objective!.position).toBeGreaterThanOrEqual(1);
    expect(objectivePool(4).some((o) => o.kind === g.objective!.kind && o.k === g.objective!.k && o.pts === g.objective!.pts)).toBe(true);
    expect(viewFor(g, "p1").objective!.position).toBe(g.objective!.position);
    expect(viewFor(g, "p2").objective).toMatchObject({ kind: g.objective!.kind, position: null });
    const v = place(g, "pr", 1); expect(viewFor(v, "p3").objective!.position).toBeNull();
    const done = castVotes(v, { p1: 1, p2: 1, p3: 2, p4: 2 });
    expect(viewFor(done, "p2").objective).toBeNull(); expect(done.lastResult!.objective!.position).toBe(g.objective!.position);
    // senza PROPAGANDA l'opzione non fa nulla
    expect(toSuspect(start(4, { objectives: true })).objective ?? null).toBeNull();
  });

  it("obiettivo centrato (sui voti ufficiali, dopo i segnalini): punti al Megafono", () => {
    const base = P(4, ["pr", "im"], { objectives: true }); const { a, b } = pos(base);
    const g: GameState = { ...base, objective: { kind: "almeno", k: 3, pts: 5, position: a } as Objective };
    const r = castVotes(place(g, "pr", a), { p1: b, p2: a, p3: a, p4: b }).lastResult!;   // 2 voti + 1 della Propaganda = 3
    expect(r.objective).toMatchObject({ votes: 3, megaHit: true, winners: [] });
    expect(r.lines.p1!.map((l) => l.kind)).toEqual(["obiettivo"]); expect(r.points.p1).toBe(5);
  });

  it("obiettivo mancato: i punti vanno a chi ha votato quel personaggio (voto valido, Megafono escluso)", () => {
    const base = P(4, ["pr", "im"], { objectives: true }); const { a, b, c } = pos(base);
    let g: GameState = { ...base, objective: { kind: "almeno", k: 3, pts: 5, position: a } as Objective };
    let r = castVotes(place(g, "pr", c), { p1: a, p2: a, p3: b, p4: b }).lastResult!;     // a: 2 voti, meno di 3
    expect(r.objective).toMatchObject({ votes: 2, megaHit: false, winners: ["p2"] });
    expect(r.lines.p2!.map((l) => l.kind)).toContain("obiettivo-folla"); expect(r.lines.p1!.map((l) => l.kind)).toContain("obiettivo-mancato");
    // «nessun voto» mancato: chi ha votato prende i punti; con l'Imbroglio! i voti annullati non contano (e non danno punti)
    g = { ...base, objective: { kind: "nessuno", k: 0, pts: 4, position: a } as Objective };
    r = castVotes(place(g, "im", a), { p1: b, p2: a, p3: b, p4: c }).lastResult!;
    expect(r.objective).toMatchObject({ votes: 0, megaHit: true });
    g = { ...base, objective: { kind: "esattamente", k: 2, pts: 4, position: b } as Objective };
    r = castVotes(place(g, "pr", c), { p1: a, p2: b, p3: b, p4: b }).lastResult!;
    expect(r.objective).toMatchObject({ votes: 3, megaHit: false, winners: ["p2", "p3", "p4"] });
    expect(r.points.p4).toBe(2 + 4);
  });

  it("i bot giocano PROPAGANDA (con e senza obiettivi) fino in fondo, da 3 a 8 giocatori, senza azioni illegali", () => {
    for (const objectives of [false, true]) for (const n of [3, 5, 8]) for (const level of ["easy", "medium", "hard"] as const) {
      let s = createGame({ ...cfg(n, { seed: 11 + n, propaganda: true, objectives, miniGame: false }), luiSlots: undefined }).state;
      const mem = newBotMemory(); let seed = 3;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 3000 && s.phase !== "GAME_OVER"; i++) {
        if (s.phase === "RESULTS") { s = act(s, { type: "advance" }); continue; }
        const a = s.playerIds.map((p) => chooseBotAction(s, p, level, mem, rand)).find((x) => x);
        s = act(s, a!);
      }
      expect(s.phase, `${n} ${level} ${objectives}`).toBe("GAME_OVER");
    }
  });
});
