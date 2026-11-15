import { describe, expect, it } from "vitest";
import { BOT_ENGINES } from "@gdt/game-engine";
import type { BotLevel, GameState } from "@gdt/game-engine";
import { compareGroups, csvCell, gamesCsv, lineupFor, parseSpec, playGame, resultsJson, runTournament, summarize, summaryCsv, summaryTables } from "../src/index.ts";
import type { AgentSpec, GameRow, TournamentConfig } from "../src/index.ts";
import { content } from "./fixtures.ts";

const spec = (s: string): AgentSpec => parseSpec(s);
const cfg4 = (over: Partial<TournamentConfig> = {}): TournamentConfig => ({ games: 12, players: 4, seed: 7, participants: ["baseline-1:hard", "production:hard", "baseline-1:medium", "production:easy"].map(spec), ...over });

describe("tornei ripetibili", () => {
  it("stessa configurazione (anche dopo un giro per JSON) = stessi risultati; seme diverso = risultati diversi", () => {
    const a = runTournament(cfg4(), content), b = runTournament(JSON.parse(JSON.stringify(cfg4())) as TournamentConfig, content), c = runTournament(cfg4({ seed: 8 }), content);
    expect(b.resultsHash).toBe(a.resultsHash); expect(b.games.map((g) => g.seats.map((s) => s.score))).toEqual(a.games.map((g) => g.seats.map((s) => s.score)));
    expect(c.resultsHash).not.toBe(a.resultsHash);
  });
  it("l'impronta non dipende dai tempi di calcolo", () => {
    const a = runTournament(cfg4({ games: 4 }), content), b = runTournament(cfg4({ games: 4 }), content);
    expect(a.games[0]!.seats[0]!.ms).toBeGreaterThan(0);   // i tempi si misurano (e variano da una corsa all'altra)…
    expect(a.resultsHash).toBe(b.resultsHash);              // …ma non entrano nell'impronta
  });
  it("baseline-1 e production (stesso codice) danno partite IDENTICHE a parità di posti e seme", () => {
    const mk = (engine: string) => runTournament({ games: 10, players: 4, seed: 3, participants: Array.from({ length: 4 }, () => ({ engine, level: "hard" as const })) }, content);
    const a = mk("baseline-1"), b = mk("production");
    expect(b.games.map((g) => g.seats.map((s) => [s.score, s.place]))).toEqual(a.games.map((g) => g.seats.map((s) => [s.score, s.place])));
  });
  it("una configurazione parziale si ferma su richiesta", () => {
    let n = 0; const r = runTournament(cfg4({ games: 50 }), content, { onGame: () => { n++; }, shouldStop: () => n >= 3 });
    expect(r.games.length).toBe(3);
  });
});

describe("posti e formazioni", () => {
  it("formazione fissa: tutti i partecipanti compaiono in ogni partita e ruotano su tutti i posti in modo equilibrato", () => {
    const cfg = cfg4({ games: 400 }), count = new Map<string, number[]>();
    for (let g = 0; g < cfg.games; g++) lineupFor(cfg, cfg.seed + g * 7919).forEach((s, i) => { const k = `${s.engine}:${s.level}`, c = count.get(k) ?? [0, 0, 0, 0]; c[i]!++; count.set(k, c); });
    expect(count.size).toBe(4);
    for (const c of count.values()) for (const x of c) { expect(x).toBeGreaterThan(70); expect(x).toBeLessThan(130); }   // atteso 100
  });
  it("formazione a gruppo: estrae giocatori distinti dal gruppo e rifiuta gruppi troppo piccoli", () => {
    const pool = ["baseline-1:easy", "baseline-1:medium", "baseline-1:hard", "production:hard", "production:medium", "production:easy"].map(spec);
    const cfg: TournamentConfig = { games: 1, players: 4, seed: 1, participants: pool, lineup: "pool" };
    for (let k = 0; k < 30; k++) { const l = lineupFor(cfg, k * 31), keys = l.map((s) => `${s.engine}:${s.level}`); expect(new Set(keys).size).toBe(4); }
    expect(() => runTournament({ ...cfg, players: 8 }, content)).toThrow(/più piccolo/);
    expect(() => runTournament(cfg4({ participants: pool }), content)).toThrow(/esattamente/);
  });
  it("validazione: parametri e motori sconosciuti", () => {
    expect(() => parseSpec("nonesiste:hard")).toThrow(/sconosciuto/); expect(() => parseSpec("baseline-1:difficilissimo")).toThrow(/livello/);
    expect(() => parseSpec("baseline-1:hard:nonesiste")).toThrow(/carattere/);
    expect(() => runTournament(cfg4({ games: 0 }), content)).toThrow(/games/); expect(() => runTournament(cfg4({ players: 2 }), content)).toThrow(/players/);
  });
});

describe("partite del laboratorio", () => {
  it("da 3 a 8 giocatori: partite complete, nessun problema, quote di vittoria che sommano 1, posti coerenti", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const r = runTournament({ games: 6, players: n, seed: n, participants: Array.from({ length: n }, (_, i) => ({ engine: i % 2 ? "production" : "baseline-1", level: (["easy", "medium", "hard"] as const)[i % 3]!, style: "random" })) }, content);
      for (const g of r.games) {
        expect(g.problems, `n ${n} partita ${g.game}`).toEqual([]);
        expect(g.seats.reduce((a, s) => a + s.winShare, 0)).toBeCloseTo(1, 10);
        for (const s of g.seats) { expect(s.place).toBeGreaterThanOrEqual(1); expect(s.place).toBeLessThanOrEqual(n); expect(s.winShare > 0).toBe(s.place === 1); }
        expect(g.seats.reduce((a, s) => a + s.margin, 0)).toBeCloseTo(0, 8);
      }
    }
  });
  it("i caratteri «random» sono distinti tra i posti e ripetibili con il seme", () => {
    const seats = Array.from({ length: 5 }, () => spec("production:hard:random")), a = playGame(seats, 0, 11, content), b = playGame(seats, 0, 11, content);
    expect(new Set(a.seats.map((s) => s.style)).size).toBe(5); expect(a.seats.map((s) => s.style)).toEqual(b.seats.map((s) => s.style));
  });
  it("mosse simultanee: nello stesso passo tutti decidono dallo STESSO stato", () => {
    const calls: { phase: string; turn: number; played: number; voted: number }[] = [];
    const prod = BOT_ENGINES["production"]!;
    (BOT_ENGINES as Record<string, unknown>)["spy-test"] = { ...prod, id: "spy-test", chooseAction: (s: GameState, me: string, lv: BotLevel, mem: never, rand: () => number) => {
      calls.push({ phase: s.phase, turn: s.turnNumber, played: Object.keys(s.played).length, voted: Object.keys(s.votes).length });
      return prod.chooseAction(s, me, lv, mem, rand);
    } };
    try {
      const row = playGame(Array.from({ length: 4 }, () => ({ engine: "spy-test" })), 0, 5, content);
      expect(row.problems).toEqual([]); expect(calls.length % 4).toBe(0);
      for (let i = 0; i < calls.length; i += 4) { const g = calls.slice(i, i + 4); for (const c of g) expect(c).toEqual(g[0]); }
      expect(calls.some((c) => c.phase === "PLAY")).toBe(true); expect(calls.some((c) => c.phase === "VOTE")).toBe(true);
    } finally { delete (BOT_ENGINES as Record<string, unknown>)["spy-test"]; }
  });
  it("azione illegale: errore chiaro in modalità rigorosa, problema registrato altrimenti", () => {
    const prod = BOT_ENGINES["production"]!;
    (BOT_ENGINES as Record<string, unknown>)["bad-test"] = { ...prod, id: "bad-test", chooseAction: (s: GameState, me: string, lv: BotLevel, mem: never, rand: () => number) => (s.phase === "VOTE" && s.votes[me] === undefined ? { type: "vote", playerId: me, position: 99 } : prod.chooseAction(s, me, lv, mem, rand)) };
    try {
      const seats = [spec("bad-test"), spec("production:easy"), spec("production:easy")];
      expect(() => playGame(seats, 0, 1, content)).toThrow(/posto 1.*illegale/);
      const row = playGame(seats, 0, 1, content, { strict: false });
      expect(row.problems.length).toBeGreaterThan(0);
    } finally { delete (BOT_ENGINES as Record<string, unknown>)["bad-test"]; }
  });
});

describe("parametri di taratura per versione", () => {
  it("si applicano durante il torneo e si ripristinano alla fine (anche in caso di errore)", () => {
    const orig = BOT_ENGINES["baseline-1"]!.tune.tempHard!; let seen = 0;
    runTournament(cfg4({ games: 2, tune: { "baseline-1": { tempHard: 99 } } }), content, { onGame: () => { seen = BOT_ENGINES["baseline-1"]!.tune.tempHard!; } });
    expect(seen).toBe(99); expect(BOT_ENGINES["baseline-1"]!.tune.tempHard).toBe(orig);
    expect(() => runTournament(cfg4({ tune: { "baseline-1": { tempHard: 5, nonEsiste: 1 } } }), content)).toThrow(/sconosciuto/);
    expect(BOT_ENGINES["baseline-1"]!.tune.tempHard).toBe(orig);   // ripristinato anche dopo il rifiuto
    expect(BOT_ENGINES["production"]!.tune.tempHard).toBe(orig);   // le altre versioni non sono toccate
  });
  it("un parametro cambia davvero le decisioni (il laboratorio misura ciò che si chiede)", () => {
    const base = runTournament(cfg4({ games: 6 }), content), alt = runTournament(cfg4({ games: 6, tune: { "baseline-1": { cncTempHard: 5, cncVoteTempHard: 5, propVoteTempMed: 5, propTempMed: 5 } } }), content);
    expect(alt.resultsHash).not.toBe(base.resultsHash);
  });
});

describe("riepiloghi, confronti ed esportazione", () => {
  const synthetic = (): GameRow[] => Array.from({ length: 60 }, (_, g) => ({
    game: g, seed: g, players: 4, turns: 4, golden: false, problems: [],
    seats: [10, 8, 6, 4].map((score, i) => ({ seat: i + 1, participant: i < 2 ? "A:hard" : "B:easy", engine: i < 2 ? "A" : "B", level: i < 2 ? "hard" : "easy", style: "neutro", score: score + (g % 3), place: i + 1, winShare: i === 0 ? 1 : 0, margin: 0, decisions: 10, ms: 5, maxMs: 1 })),
  }));
  it("compareGroups: differenza appaiata esatta su dati sintetici", () => {
    const c = compareGroups(synthetic(), (s) => s.engine === "A", (s) => s.engine === "B");
    expect(c.games).toBe(60); expect(c.score.mean).toBeCloseTo((10 + 8) / 2 - (6 + 4) / 2, 10); expect(c.score.significant).toBe(true);
    expect(c.place.mean).toBeCloseTo(1.5 - 3.5, 10); expect(c.winRate.mean).toBeCloseTo(0.5, 10);
  });
  it("summarize: media, quota vittorie e posizione per partecipante", () => {
    const s = Object.fromEntries(summarize(synthetic()).map((x) => [x.key, x]));
    expect(s["A:hard"]!.games).toBe(120); expect(s["A:hard"]!.winRate.mean).toBeCloseTo(0.5, 10); expect(s["B:easy"]!.winRate.mean).toBe(0);
  });
  it("CSV: intestazione, una riga per posto e partita, escape corretto", () => {
    const r = runTournament(cfg4({ games: 5 }), content), lines = gamesCsv(r.games).trim().split("\n");
    expect(lines[0]).toBe("game,seed,players,turns,golden,seat,participant,engine,level,style,score,place,winShare,margin,decisions,ms,maxMs");
    expect(lines.length).toBe(1 + 5 * 4); expect(lines[1]!.split(",").length).toBe(17);
    expect(csvCell('a,"b"')).toBe('"a,""b"""'); expect(csvCell(NaN)).toBe(""); expect(csvCell("x")).toBe("x");
    const sum = summaryCsv(summaryTables(r.games)).trim().split("\n"); expect(sum[0]!.startsWith("group,key,games,winRate")).toBe(true);
    expect(sum.some((l) => l.startsWith("participant,baseline-1:hard,"))).toBe(true); expect(sum.some((l) => l.startsWith("players,4 giocatori,"))).toBe(true);
  });
  it("JSON: contiene configurazione, versioni, impronta e partite, e si rilegge", () => {
    const r = runTournament(cfg4({ games: 3, name: "prova" }), content), j = JSON.parse(resultsJson(r));
    expect(j.config.name).toBe("prova"); expect(j.resultsHash).toBe(r.resultsHash); expect(j.games.length).toBe(3);
    expect(j.engines["baseline-1"].label).toMatch(/Baseline/); expect(j.summary.participant.length).toBe(4);
    const again = runTournament(j.config, content); expect(again.resultsHash).toBe(r.resultsHash);   // il JSON basta per ripetere l'esperimento
  });
});
