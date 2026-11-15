import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, learnFromResult, newBotMemory, observe } from "@gdt/game-engine";
import type { BotLevel } from "@gdt/game-engine";
import { choicesOf, contextOf, defaultTypeGrid, describePlayer, DEFAULT_PRIOR, fitMAP, fitTypeWeights, learnTurn, mixProbs, newOpponentMemory, optionFeatures, posterior, predictCrowd, predictFall, predictVotes, turnDataOf, typeLogLiks, typePosterior, whoOf } from "../src/index.ts";
import type { Choice, OpponentPrior, TurnData } from "../src/index.ts";
import { nextRandom } from "../../game-engine/src/rng.ts";
import { hideFrom } from "../../game-engine/tests/hideFrom.ts";
import { cfg } from "../../game-engine/tests/helpers.ts";

const rng = (seed: number) => { let r = seed | 0; return () => { const x = nextRandom(r); r = x.state; return x.value; }; };
const sampleFrom = (p: number[], u: number) => { let k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } return k; };
const softmaxArr = (s: number[]) => { const m = Math.max(...s), e = s.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); };

/** Scelte sintetiche da un β noto con caratteristiche casuali. */
function synth(beta: number[], n: number, count: number, seed: number, opts: { eps?: number; opts?: number } = {}): Choice[] {
  const r = rng(seed), K = opts.opts ?? 5, out: Choice[] = [];
  for (let i = 0; i < count; i++) {
    const x = Array.from({ length: K }, () => beta.map(() => Math.round((r() * 4 - 2) * 10) / 10));
    const p = softmaxArr(x.map((row) => row.reduce((a, v, j) => a + v * beta[j]!, 0))), eps = opts.eps ?? 0;
    out.push({ x, y: r() < eps ? Math.floor(r() * K) : sampleFrom(p, r()), w: 1 });
  }
  void n; return out;
}

describe("logit multinomiale con prior (MAP)", () => {
  it("recupera i coefficienti veri da molti dati e si fida del prior con pochi", () => {
    const truth = [1.2, -0.7, 0.4], data = synth(truth, 3, 4000, 1), weak = [3, 3, 3], f = fitMAP(data, [0, 0, 0], weak);
    f.beta.forEach((b, i) => expect(b).toBeCloseTo(truth[i]!, 0)); for (const b of f.beta.map((b, i) => Math.abs(b - truth[i]!))) expect(b).toBeLessThan(0.12);
    const few = fitMAP(data.slice(0, 3), [0, 0, 0], [0.05, 0.05, 0.05]); for (const b of few.beta) expect(Math.abs(b)).toBeLessThan(0.1);   // prior stretto + 3 dati: resta vicino al prior
    expect(fitMAP([], [0.3, 0.2, 0.1], [1, 1, 1]).beta).toEqual([0.3, 0.2, 0.1]);
  });
  it("l'incertezza a posteriori scende con i dati", () => {
    const truth = [1, 0.5], a = fitMAP(synth(truth, 2, 20, 2), [0, 0], [3, 3]), b = fitMAP(synth(truth, 2, 2000, 2), [0, 0], [3, 3]);
    expect(b.sd[0]!).toBeLessThan(a.sd[0]! / 5);
  });
  it("il punto trovato è un minimo: perturbarlo peggiora la log-verosimiglianza penalizzata", () => {
    const data = synth([0.8, -0.4, 0.2], 3, 300, 3), mu = [0, 0, 0], sg = [1, 1, 1], f = fitMAP(data, mu, sg);
    const obj = (b: number[]) => -data.reduce((a, c) => { const s = c.x.map((r) => r.reduce((t, v, j) => t + v * b[j]!, 0)), m = Math.max(...s), z = Math.log(s.reduce((t, v) => t + Math.exp(v - m), 0)) + m; return a + (s[c.y]! - z); }, 0) + b.reduce((a, v, j) => a + (v - mu[j]!) ** 2 / (2 * sg[j]! ** 2), 0);
    for (let j = 0; j < 3; j++) for (const d of [-0.05, 0.05]) { const p = f.beta.slice(); p[j]! += d; expect(obj(p)).toBeGreaterThanOrEqual(obj(f.beta) - 1e-9); }
  });
});

describe("tipi (λ, ε): ragionamento bayesiano per tipi", () => {
  const g = defaultTypeGrid(), beta = [1.5, 0, 0, 0, 0, 0];
  const mk = (lambda: number, eps: number, count: number, seed: number): Choice[] => {
    const r = rng(seed), out: Choice[] = [];
    for (let i = 0; i < count; i++) { const x = Array.from({ length: 5 }, () => [Math.round(r() * 6 - 3), 0, 0, 0, 0, 0]), p = mixProbs(x, beta, lambda, eps); out.push({ x, y: sampleFrom(p, r()), w: 1 }); }
    return out;
  };
  it("mixProbs: somma 1; ε = 1 o λ = 0 → uniforme", () => {
    const x = [[2, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [-1, 0, 0, 0, 0, 0]];
    expect(mixProbs(x, beta, 1, 0.2).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    mixProbs(x, beta, 1, 1).forEach((p) => expect(p).toBeCloseTo(1 / 3, 12)); mixProbs(x, beta, 0, 0).forEach((p) => expect(p).toBeCloseTo(1 / 3, 12));
  });
  it("il posteriore si concentra sul tipo vero con molti voti e resta largo con uno solo", () => {
    const sharp = mk(2, 0, 80, 1), noisy = mk(0.5, 0.6, 80, 2), post = (c: Choice[]) => typePosterior(g, typeLogLiks(c, [], beta, beta, g));
    const exp = (p: number[], f: (t: { lambda: number; eps: number }) => number) => p.reduce((a, w, i) => a + w * f({ lambda: g.lambda[Math.floor(i / g.eps.length)]!, eps: g.eps[i % g.eps.length]! }), 0);
    // λ ed ε non sono identificabili separatamente (una miscela molto casuale somiglia a una poco netta): conta la previsione, cioè quanta probabilità va all'opzione migliore
    const probe = [[3, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [-1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [-3, 0, 0, 0, 0, 0]];
    const top = (p: number[]) => p.reduce((a, w, i) => a + w * mixProbs(probe, beta, g.lambda[Math.floor(i / g.eps.length)]!, g.eps[i % g.eps.length]!)[0]!, 0);
    expect(top(post(sharp))).toBeGreaterThan(top(post(noisy)) + 0.2); expect(exp(post(noisy), (t) => t.eps)).toBeGreaterThan(exp(post(sharp), (t) => t.eps));
    const one = describePlayerFromChoices(sharp.slice(0, 1)), many = describePlayerFromChoices(sharp);
    expect(one.uncertainty).toBeGreaterThan(0.95); expect(many.uncertainty).toBeLessThan(one.uncertainty - 0.1);   // con un voto non si «assegna una personalità»
    function describePlayerFromChoices(c: Choice[]) { const p = post(c); return { uncertainty: -p.reduce((a, w) => a + (w > 0 ? w * Math.log(w) : 0), 0) / Math.log(p.length) }; }
  });
  it("EM: ritrova una popolazione fatta di due gruppi (netti e casuali)", () => {
    const players = [...Array.from({ length: 60 }, (_, i) => ({ crowd: mk(2, 0, 8, 100 + i), mega: [] as Choice[] })), ...Array.from({ length: 60 }, (_, i) => ({ crowd: mk(0.5, 0.6, 8, 500 + i), mega: [] as Choice[] }))];
    const w = fitTypeWeights(players, beta, beta, g, { alpha: 0.5 }), E = g.eps.length, mass = (f: (l: number, e: number) => boolean) => w.reduce((a, x, i) => a + (f(g.lambda[Math.floor(i / E)]!, g.eps[i % E]!) ? x : 0), 0);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    void mass;
    const lls = players.map((p) => typeLogLiks(p.crowd, p.mega, beta, beta, g)), avg = (ww: number[]) => lls.reduce((a, l) => a + Math.log(l.reduce((t, v, i) => t + ww[i]! * Math.exp(v), 0)), 0) / lls.length;
    expect(avg(w)).toBeGreaterThan(avg(g.w.slice()) + 0.2);   // i pesi stimati spiegano i voti meglio di un prior uniforme sui tipi
    const flat = w.map((x, i) => (g.eps[i % E]! >= 0.45 ? x : 0)).reduce((a, b) => a + b, 0); expect(flat).toBeGreaterThan(0.2); expect(flat).toBeLessThan(0.8);   // la popolazione contiene entrambi i comportamenti
  });
});

describe("Opponent Model sui turni", () => {
  const ctx = { n: 5, cards: ["a", "b", "c", "d", "e"], phrase: null, markPos: 3 };
  const turn = (votes: Record<string, number>, over: Partial<TurnData> = {}): TurnData => ({ ...ctx, mega: "p1", votes, owners: ["p2", "p3", "p4", "p5", "p1"], fallen: [3], markType: "cade", ...over });
  it("optionFeatures: segnalino, propria carta e bordi; senza etichette l'affinità è zero", () => {
    const x = optionFeatures(ctx, 2); expect(x.map((r) => r[2])).toEqual([0, 0, 1, 0, 0]); expect(x.map((r) => r[3])).toEqual([0, 1, 0, 0, 0]);
    expect(x.map((r) => r[4])).toEqual([1, 0, 0, 0, 0]); expect(x.map((r) => r[5])).toEqual([0, 0, 0, 0, 1]); expect(x.every((r) => r[0] === 0 && r[1] === 0)).toBe(true);
  });
  it("choicesOf: una scelta per ogni turno passato nel ruolo giusto, con la propria carta nota", () => {
    const mem = newOpponentMemory(); learnTurn(mem, turn({ p1: 1, p2: 3, p3: 3, p4: 2, p5: 3 })); learnTurn(mem, turn({ p1: 2, p2: 4, p3: 1, p4: 1, p5: 1 }, { mega: "p2" }));
    expect(choicesOf(mem.turns, "p3", "crowd").map((c) => c.y)).toEqual([2, 0]); expect(choicesOf(mem.turns, "p2", "mega").map((c) => c.y)).toEqual([3]); expect(choicesOf(mem.turns, "p2", "crowd").length).toBe(1);
    expect(choicesOf(mem.turns, "p3", "crowd")[0]!.x[1]![3]).toBe(1);   // p3 aveva giocato la carta in posizione 2
    expect(choicesOf(mem.turns, "p3", "crowd", 0.5).map((c) => c.w)).toEqual([0.5, 1]);   // decadimento: il più vecchio pesa meno
  });
  it("predictVotes: distribuzioni valide per ogni altro giocatore, escluso me; il prior sposta massa sul segnalino", () => {
    const mem = newOpponentMemory(), who = { me: "p1", mega: "p2", myPos: 1, players: ["p1", "p2", "p3", "p4", "p5"] }, pr = predictVotes(mem, ctx, who, { prior: DEFAULT_PRIOR });
    expect(Object.keys(pr).sort()).toEqual(["p2", "p3", "p4", "p5"]);
    for (const p of Object.values(pr)) { expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10); expect(p[2]!).toBeGreaterThan(p[0]!); }   // posizione 3 = segnalino
  });
  it("adattamento (modalità coefficienti): chi vota sempre la prima carta diventa prevedibile", () => {
    const mem = newOpponentMemory(), who = { me: "p1", mega: "p1", myPos: 2, players: ["p1", "p2", "p3"] }, c3 = { ...ctx, n: 3, cards: ["a", "b", "c"], markPos: 2 }, r = rng(5);
    const prior: OpponentPrior = { ...DEFAULT_PRIOR, sigma: [0.2, 0.2, 0.3, 0.3, 0.8, 0.8] };   // le abitudini di posizione possono pesare
    const before = predictVotes(mem, c3, who, { prior, mode: "coef" })["p3"]![0]!;
    for (let t = 0; t < 10; t++) { const perm = ["p1", "p2", "p3"].sort(() => r() - 0.5); learnTurn(mem, { ...c3, mega: "p1", votes: { p1: 2, p2: 2 + Math.floor(r() * 2), p3: 1 }, owners: perm, fallen: [1], markType: "noncade" }); }
    const after = predictVotes(mem, c3, who, { prior, mode: "coef" })["p3"]![0]!;
    expect(after).toBeGreaterThan(before + 0.1);
  });
  it("modalità tipi: chi vota a caso viene riconosciuto come tale (λ basso / ε alto) solo dopo più voti", () => {
    const mem = newOpponentMemory(), r = rng(9), prior: OpponentPrior = { ...DEFAULT_PRIOR, crowd: [0, 0, 1.5, 0, 0, 0], mega: [0, 0, 1.5, 0, 0, 0] };
    const mk2 = () => turn({ p1: 1, p2: 1 + Math.floor(r() * 5), p3: 3, p4: 3, p5: 3 }, { markPos: 3 });   // p2 vota a caso, gli altri seguono il segnalino
    learnTurn(mem, mk2()); const a = describePlayer(mem, "p2", prior); for (let i = 0; i < 12; i++) learnTurn(mem, mk2()); const b = describePlayer(mem, "p2", prior), c = describePlayer(mem, "p3", prior);
    expect(a.uncertainty).toBeGreaterThan(b.uncertainty); expect(b.lambda).toBeLessThan(c.lambda); expect(b.eps).toBeGreaterThan(c.eps);
    expect(b.votes).toBe(13);
  });
  it("posterior (scala): λ = 1 senza dati e si abbassa per chi non segue gli indizi", () => {
    const prior: OpponentPrior = { ...DEFAULT_PRIOR, crowd: [0, 0, 1.5, 0, 0, 0] }, mem = newOpponentMemory(), r = rng(3);
    expect(posterior(mem, "p2", "crowd", prior, 1, "scale").lambda).toBe(1);
    for (let i = 0; i < 30; i++) learnTurn(mem, turn({ p1: 1, p2: 1 + Math.floor(r() * 5), p3: 3, p4: 3, p5: 3 }));
    expect(posterior(mem, "p2", "crowd", prior, 1, "scale").lambda).toBeLessThan(0.6); expect(posterior(mem, "p3", "crowd", prior, 1, "scale").lambda).toBeGreaterThan(0.9);
  });
});

describe("previsione della folla e della caduta", () => {
  const unan = (k: number, n: number) => Object.fromEntries(["a", "b", "c"].map((p) => [p, Array.from({ length: n }, (_, i) => (i + 1 === k ? 1 : 0))]));
  it("predictCrowd: massa sul più votato e convergenza", () => {
    const c = predictCrowd(unan(2, 4), rng(1), 100); expect(c.lead[1]).toBeCloseTo(1, 10); expect(c.conv[3]).toBeCloseTo(1, 10); expect(c.conv[1]).toBeCloseTo(1, 10);
    const u = predictCrowd(Object.fromEntries(["a", "b", "c"].map((p) => [p, [0.25, 0.25, 0.25, 0.25]])), rng(2), 4000); expect(u.lead.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    u.lead.forEach((p) => expect(p).toBeCloseTo(0.25, 1));
    expect(u.conv[2]!).toBeGreaterThan(0.6); expect(u.conv[2]!).toBeLessThan(0.8);   // 3 votanti su 4 carte: P(almeno due uguali) = 1 − 4·3·2/64 = 0,625
    expect(u.conv[2]!).toBeCloseTo(0.625, 1);
  });
  it("predictFall: voti unanimi fanno cadere la carta, tranne se è annullata da VOTI NULLI!", () => {
    predictFall(unan(2, 4), 3, rng(1), { samples: 60 }).forEach((v, i) => expect(v).toBeCloseTo(i === 1 ? 1 : 0, 9));   // segnalino altrove: cade sempre la 2
    expect(predictFall(unan(2, 4), 2, rng(1), { samples: 3000 })[1]!).toBeCloseTo(2 / 3, 1);     // segnalino sulla 2: con VOTI NULLI! (1/3 dei casi) non cade
    expect(predictFall(unan(2, 4), 2, rng(1), { samples: 60, markType: "cade" })[1]!).toBeCloseTo(1, 9);
  });
});

describe("l'Opponent Model usa solo ciò che sa il giocatore", () => {
  it("le previsioni calcolate dall'osservazione non cambiano se si alterano i dati nascosti, e la memoria si costruisce solo da turni rivelati", () => {
    let compared = 0, learned = 0;
    for (const n of [3, 5]) for (let seed = 1; seed <= 3; seed++) {
      let s = createGame(cfg(n, { seed })).state; const bm = newBotMemory(), mems = new Map(s.playerIds.map((p) => [p, newOpponentMemory()])), r = rng(seed * 17 + n); let g = 0;
      while (s.phase !== "GAME_OVER" && g++ < 3000) {
        if (s.phase === "RESULTS") { for (const p of s.playerIds) { const t = turnDataOf(observe(s, p)); expect(t).not.toBeNull(); learnTurn(mems.get(p)!, t!); learned++; } learnFromResult(bm, s.tower, s.lastResult!); s = applyAction(s, { type: "advance" }).state; continue; }
        if (s.phase === "VOTE") for (const p of s.playerIds) {
          const a = predictVotes(mems.get(p)!, contextOf(observe(s, p)), whoOf(observe(s, p))), b = predictVotes(mems.get(p)!, contextOf(observe(hideFrom(s, p), p)), whoOf(observe(hideFrom(s, p), p)));
          expect(b).toEqual(a); compared++;
        }
        let act = null; for (const p of s.playerIds) { act = chooseBotAction(s, p, (["easy", "medium", "hard"] as BotLevel[])[(seed + g) % 3]!, bm, r); if (act) break; }
        if (!act) break; s = applyAction(s, act).state;
      }
    }
    expect(compared).toBeGreaterThan(40); expect(learned).toBeGreaterThan(40);
  });
  it("turnDataOf è nullo prima dello spoglio", () => {
    const s = createGame(cfg(4, { seed: 1 })).state; expect(turnDataOf(observe(s, s.playerIds[0]!))).toBeNull();
  });
});
