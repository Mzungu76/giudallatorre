import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, isLegal, learnFromResult, newBotMemory, observe } from "@gdt/game-engine";
import type { Action, BotLevel, GameState } from "@gdt/game-engine";
import { evaluateCandidates, makeStrategicEngine, DEFAULT_STRATEGIC, phi, sampleFrom, softmaxPick, strategicPts, strategicWin, STRATEGIC_ENGINES } from "../src/index.ts";
import { nextRandom } from "../../game-engine/src/rng.ts";
import { hideFrom } from "../../game-engine/tests/hideFrom.ts";
import { cfg } from "../../game-engine/tests/helpers.ts";

const rng = (seed: number) => { let r = seed | 0; return () => { const x = nextRandom(r); r = x.state; return x.value; }; };
const STYLE = { id: "n", conf: 0.5, herd: 0.5, bluff: 0.5, susp: 0.5, risk: 0.5, speed: 0.5 };

describe("Simulation Engine: Monte Carlo con numeri casuali comuni", () => {
  it("phi e sampleFrom", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6); expect(phi(1.959964)).toBeCloseTo(0.975, 4); expect(phi(-3)).toBeLessThan(0.002);
    expect(sampleFrom([0.2, 0.5, 0.3], 0.1)).toBe(1); expect(sampleFrom([0.2, 0.5, 0.3], 0.5)).toBe(2); expect(sampleFrom([0.2, 0.5, 0.3], 0.95)).toBe(3);
  });
  it("trova il candidato migliore e, con numeri casuali comuni, si ferma presto anche con molto rumore comune", () => {
    const r = rng(1), res = evaluateCandidates(4, () => r() * 100, (c, w) => w + [0, 1, 3, 2][c]!, { samples: 400, minSamples: 30 });   // rumore enorme ma comune a tutti
    expect(res.means.indexOf(Math.max(...res.means))).toBe(2); expect(res.stopped).toBe("early"); expect(res.n).toBeLessThan(400);
  });
  it("senza differenza reale non si ferma prima del dovuto", () => {
    const r = rng(2), res = evaluateCandidates(3, () => r(), (_c, w) => w, { samples: 120, minSamples: 30 });
    expect(res.n).toBe(120); expect(res.stopped).toBe("done");
  });
  it("limite di tempo: restituisce comunque stime finite (migliore trovata finora)", () => {
    const r = rng(3), t0 = performance.now(), res = evaluateCandidates(2, () => r(), (c, w) => { const e = performance.now() + 2; while (performance.now() < e); return w + c; }, { samples: 1000, deadlineMs: 20, batch: 2 });
    expect(res.stopped).toBe("deadline"); expect(res.n).toBeGreaterThan(0); expect(res.n).toBeLessThan(1000); expect(res.means.every(Number.isFinite)).toBe(true); expect(performance.now() - t0).toBeLessThan(200);
  });
  it("ripetibile con lo stesso generatore", () => {
    const run = () => { const r = rng(9); return evaluateCandidates(3, () => r(), (c, w) => w * (c + 1), { samples: 50 }); };
    expect(run()).toEqual(run());
  });
  it("softmaxPick: tau = 0 sceglie il migliore; tau alta quasi uniforme; tau bassa quasi sempre il migliore", () => {
    const r = rng(4), vals = [1, 3, 2]; expect(softmaxPick(vals, 0, r)).toBe(1);
    const count = (tau: number) => { const c = [0, 0, 0]; for (let i = 0; i < 3000; i++) c[softmaxPick(vals, tau, r)]!++; return c; };
    expect(count(0.05)[1]!).toBeGreaterThan(2900); const u = count(100); for (const x of u) expect(x).toBeGreaterThan(850);
  });
});

describe("motore strategico: decide solo dall'osservazione", () => {
  /** Percorre partite intere; i giocatori in `strategic` decidono con il motore nuovo, gli altri con i bot attuali. */
  function walk(visit: (s: GameState, p: string, a: Action | null, mem: unknown) => void, n = 4, seed = 1, engine = strategicPts, extra: { budgetMs?: number } = {}) {
    let s = createGame(cfg(n, { seed, miniGame: "random", accuseDeck: ["Mi ha rubato il panino!"] })).state; const bm = newBotMemory(), mems = new Map(s.playerIds.map((p) => [p, engine.newMemory()])), r = rng(seed * 31 + n); let g = 0;
    const ctxFor = (rand: () => number) => ({ rand, level: "hard" as BotLevel, style: STYLE, ...extra });
    while (s.phase !== "GAME_OVER" && g++ < 4000) {
      if (s.phase === "RESULTS") { for (const p of s.playerIds) engine.learn(mems.get(p)!, observe(s, p)); learnFromResult(bm, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
      if (s.phase === "MINI_RESULTS") { s = applyAction(s, { type: "advance" }).state; continue; }
      const acts: Action[] = [];
      for (const p of s.playerIds) {
        const a = (Number(p.slice(1)) % 2 ? engine.decide(mems.get(p)!, observe(s, p), ctxFor(r)) : chooseBotAction(s, p, "hard", bm, r)); visit(s, p, a, mems.get(p)); if (a) acts.push(a);
      }
      if (!acts.length) { s = applyAction(s, { type: "endRun" }).state; continue; }
      for (const a of acts) s = applyAction(s, a).state;
    }
    expect(s.phase).toBe("GAME_OVER"); return s;
  }

  it("ogni decisione è legale e le partite finiscono (3, 4, 6 giocatori; entrambe le varianti)", () => {
    for (const n of [3, 4, 6]) for (const eng of [strategicPts, strategicWin]) {
      let decided = 0; walk((s, p, a) => { if (a && Number(p.slice(1)) % 2) { expect(isLegal(observe(s, p), a), `${eng.id} ${s.phase} ${p}`).toBe(true); decided++; } }, n, n, eng);
      expect(decided).toBeGreaterThan(10);
    }
  });
  it("fair play: la decisione non cambia se si alterano mani altrui, carte coperte, voti segreti, proprietari, segnalino altrui, mazzi e seme", () => {
    let compared = 0; const phases = new Set<string>();
    for (const eng of [strategicPts, strategicWin]) {
      const mk = () => { const s = createGame(cfg(4, { seed: 5, miniGame: "random", accuseDeck: ["x"] })).state; return s; };
      void mk;
      walk((s, p, a, mem) => {
        if (Number(p.slice(1)) % 2 === 0 || !a) return;
        const same = eng.decide(mem as never, observe(hideFrom(s, p), p), { rand: rng(12345), level: "hard", style: STYLE });
        const real = eng.decide(mem as never, observe(s, p), { rand: rng(12345), level: "hard", style: STYLE });
        expect(same).toEqual(real); compared++; phases.add(s.phase);
      }, 4, 5, eng);
    }
    expect(compared).toBeGreaterThan(30); for (const ph of ["PROCLAIM", "PLAY", "SUSPECT", "VOTE"]) expect(phases.has(ph), ph).toBe(true);
  });
  it("con un tempo massimo minuscolo decide comunque, in modo legale e senza sforare molto", () => {
    let worst = 0; walk((s, p, a, ) => { void s; void p; void a; }, 4, 2, strategicPts, { budgetMs: 1 });
    const t0 = performance.now(); walk((s, p, a) => { if (a && s.phase === "SUSPECT") expect(isLegal(observe(s, p), a)).toBe(true); }, 6, 3, strategicPts, { budgetMs: 2 }); worst = performance.now() - t0;
    expect(worst).toBeLessThan(5000);
  });
  it("è ripetibile (stesso generatore → stessa partita) e registrato nei motori", () => {
    const sc = (seed: number) => JSON.stringify(walk(() => {}, 4, seed).scores);
    expect(sc(7)).toBe(sc(7)); expect(STRATEGIC_ENGINES[strategicPts.id]).toBe(strategicPts); expect(STRATEGIC_ENGINES[strategicWin.id]).toBe(strategicWin);
  });
  it("makeStrategicEngine: una configurazione con pochissime simulazioni resta valida", () => {
    const e = makeStrategicEngine({ ...DEFAULT_STRATEGIC, id: "mini", label: "mini", objective: "points", tau: 0, samples: 3, minSamples: 1 });
    walk((s, p, a) => { if (a && Number(p.slice(1)) % 2) expect(isLegal(observe(s, p), a)).toBe(true); }, 4, 4, e as never);
  });
});
