import { describe, expect, it } from "vitest";
import { observe } from "@gdt/game-engine";
import { contextOf, DEFAULT_TABLE_WEIGHT, predictVotes, STRATEGIC_ENGINES, turnDataOf, whoOf, newOpponentMemory, learnTurn, DEFAULT_PRIOR } from "@gdt/strategic-ai";
import type { StrategicEngine, TurnData } from "@gdt/strategic-ai";
import { collectLogs, compareEval, convergenceCalibration, evaluate, fitPrior, logitPredictor, parseSpec, playGame, productionCrowdPredictor, summarizeEval, turnDataFromState, uniformPredictor } from "../src/index.ts";
import type { TournamentConfig } from "../src/index.ts";
import { content } from "./fixtures.ts";

const cfg = (over: Partial<TournamentConfig> = {}): TournamentConfig => ({ games: 8, players: 4, seed: 11, participants: ["production:hard", "production:medium", "production:easy", "production:hard"].map(parseSpec), ...over });

describe("raccolta dei turni e valutazione dei predittori", () => {
  it("collectLogs: un record per turno concluso, con proprietari, voti e segnalino rivelati", () => {
    const logs = collectLogs(cfg(), content); expect(logs.length).toBe(8);
    for (const l of logs) {
      expect(l.turns.length).toBeGreaterThanOrEqual(4); expect(l.players.map((p) => p.level).sort()).toEqual(["easy", "hard", "hard", "medium"].sort());
      for (const t of l.turns) { expect(t.n).toBe(4); expect(Object.keys(t.votes).length).toBe(4); expect(t.owners.every((o) => o !== null)).toBe(true); expect(t.markPos).not.toBeNull(); expect(t.fallen.length).toBeGreaterThan(0); }
    }
  });
  it("ripetibile: stessa configurazione → stessi log; seme diverso → log diversi", () => {
    const a = collectLogs(cfg(), content), b = collectLogs(cfg(), content), c = collectLogs(cfg({ seed: 12 }), content);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a)); expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });
  it("uniforme: log-verosimiglianza esattamente ln(1/n) e numero di osservazioni = turni × osservatori × altri giocatori", () => {
    const logs = collectLogs(cfg(), content), e = evaluate(uniformPredictor, logs), turns = logs.reduce((a, l) => a + l.turns.length, 0);
    expect(e.obs.length).toBe(turns * 4 * 3); for (const o of e.obs) expect(o.logp).toBeCloseTo(Math.log(1 / 4), 12);
    expect(summarizeEval(e).accuracy.mean).toBeCloseTo(0.25, 12);   // pareggi divisi: il caso azzecca 1 volta su n
  });
  it("confronto appaiato: un predittore contro sé stesso dà differenza zero; il modello batte l'uniforme su dati con struttura", () => {
    const logs = collectLogs(cfg({ games: 40 }), content), m = evaluate(logitPredictor(DEFAULT_PRIOR, true), logs), u = evaluate(uniformPredictor, logs);
    expect(compareEval(m, m).mean).toBe(0);
    // senza etichette l'unico indizio è il segnalino: già questo basta a prevedere meglio del caso
    expect(compareEval(m, u).mean).toBeGreaterThan(0.02);
  });
  it("tutti i predittori producono distribuzioni valide (somma 1, nessun NaN) e la folla dei bot attuali non esplode senza etichette", () => {
    const logs = collectLogs(cfg({ games: 6 }), content);
    for (const p of [uniformPredictor, productionCrowdPredictor("hard"), productionCrowdPredictor("medium"), logitPredictor(DEFAULT_PRIOR, false), logitPredictor(DEFAULT_PRIOR, true)]) {
      const e = evaluate(p, logs); for (const o of e.obs) { expect(Number.isFinite(o.logp), p.id).toBe(true); expect(o.p).toBeGreaterThan(0); expect(o.p).toBeLessThanOrEqual(1); }
    }
  });
  it("calibrazione della convergenza: i valori previsti sono probabilità coerenti (conv decrescente in m)", () => {
    const e = evaluate(logitPredictor(DEFAULT_PRIOR, true), collectLogs(cfg({ games: 20 }), content)), c = convergenceCalibration(e, [2, 3]);
    expect(c[0]!.predicted).toBeGreaterThan(c[1]!.predicted); expect(c[0]!.actual).toBeGreaterThanOrEqual(c[1]!.actual);
  });
});

describe("la valutazione offline coincide con ciò che il modello fa davvero in partita", () => {
  it("le previsioni calcolate da un agente (solo osservazione, memoria costruita a ogni RESULTS) sono identiche a quelle della ri-riproduzione sui log", () => {
    const rec: { seat: number; turn: number; preds: Record<string, number[]> }[] = [], mems = new Map<string, ReturnType<typeof newOpponentMemory>>(), seen = new Map<string, number>();
    const spy: StrategicEngine<{ id: string }> = {
      id: "spy-pred", label: "spia previsioni", newMemory: () => ({ id: Math.random().toString(36) }),
      learn: (m, o) => { const t = turnDataOf(o); if (!t) return; const mem = mems.get(m.id) ?? newOpponentMemory(); mems.set(m.id, mem); learnTurn(mem, t); seen.set(m.id, (seen.get(m.id) ?? 0) + 1); },
      decide: (m, o, ctx) => {
        if (o.phase === "VOTE" && o.myVote === null) rec.push({ seat: Number(o.viewerId.slice(1)), turn: seen.get(m.id) ?? 0, preds: predictVotes(mems.get(m.id) ?? newOpponentMemory(), contextOf(o), whoOf(o), { prior: DEFAULT_PRIOR }) });
        return STRATEGIC_ENGINES["random-legal-1"]!.decide(null as never, o, ctx);
      },
    };
    (STRATEGIC_ENGINES as Record<string, unknown>)["spy-pred"] = spy;
    try {
      const turns: TurnData[] = [];
      for (const seed of [3, 4]) {
        rec.length = 0; mems.clear(); seen.clear(); turns.length = 0;
        const row = playGame(Array.from({ length: 4 }, () => parseSpec("spy-pred")), 0, seed, content, { onResults: (s) => { turns.push(turnDataFromState(s)); } });
        expect(row.problems).toEqual([]); expect(rec.length).toBe(turns.length * 4);
        // ri-riproduzione offline per ogni osservatore
        const pred = logitPredictor(DEFAULT_PRIOR, true, "x", 1, "types", DEFAULT_TABLE_WEIGHT), ids = ["p1", "p2", "p3", "p4"];
        for (let seat = 1; seat <= 4; seat++) {
          const inst = pred.make(), me = `p${seat}`;
          turns.forEach((t, ti) => {
            const myPos = t.owners.findIndex((o) => o === me) + 1, off = inst.predict(t, { me, mega: t.mega, myPos: myPos || null, players: ids }), on = rec.find((r) => r.seat === seat && r.turn === ti)!;
            expect(on, `posto ${seat} turno ${ti}`).toBeDefined();
            for (const p of Object.keys(off)) off[p]!.forEach((v, i) => expect(on.preds[p]![i]!).toBeCloseTo(v, 12));
            inst.learn(t);
          });
        }
      }
    } finally { delete (STRATEGIC_ENGINES as Record<string, unknown>)["spy-pred"]; }
  });
  it("turnDataOf (osservazione) coincide con turnDataFromState (stato completo) su turni reali", () => {
    const seen: string[] = [];
    const eng: StrategicEngine<{ n: number }> = { id: "spy-turn", label: "spia turni", newMemory: () => ({ n: 0 }), learn: (_m, o) => { const t = turnDataOf(o); if (t) seen.push(JSON.stringify(t)); }, decide: (_m, o, ctx) => STRATEGIC_ENGINES["random-legal-1"]!.decide(null as never, o, ctx) };
    (STRATEGIC_ENGINES as Record<string, unknown>)["spy-turn"] = eng;
    try {
      const truth: string[] = [];
      playGame([parseSpec("spy-turn"), parseSpec("production:hard"), parseSpec("production:easy")], 0, 5, content, { onResults: (s) => { truth.push(JSON.stringify(turnDataFromState(s))); } });
      expect(seen).toEqual(truth); expect(truth.length).toBeGreaterThan(2);
    } finally { delete (STRATEGIC_ENGINES as Record<string, unknown>)["spy-turn"]; }
    void observe;
  });
});

describe("stima del prior dai log", () => {
  it("restituisce un prior valido (coefficienti finiti, pesi dei tipi che sommano 1) scelto su dati di validazione diversi da quelli di addestramento", () => {
    const train = collectLogs(cfg({ games: 30, seed: 100 }), content), valid = collectLogs(cfg({ games: 12, seed: 900100 }), content);
    const fit = fitPrior(train, valid, { source: "test", seed: 100, date: "2026-01-01" }, "types", { alpha: [1] });
    expect(fit.prior.crowd.length).toBe(6); for (const v of [...fit.prior.crowd, ...fit.prior.mega]) expect(Number.isFinite(v)).toBe(true);
    expect(fit.prior.types!.w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4); expect(fit.prior.fittedOn!.games).toBe(30);
    expect(fit.prior.crowd[2]!).toBeGreaterThan(0);   // il segnalino attira voti (indice 2 = mark)
    expect(fit.choices.crowd).toBeGreaterThan(300);
  });
});
