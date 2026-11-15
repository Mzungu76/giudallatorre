import { choicesOf, defaultTypeGrid, fitMAP, fitTypeWeights, FEATURES } from "@gdt/strategic-ai";
import type { AdaptMode, Choice, OpponentPrior, Role } from "@gdt/strategic-ai";
import { evaluate, logitPredictor, summarizeEval } from "./predictionEval.ts";
import type { GameLog } from "./predictionEval.ts";

/** Dati di addestramento pooled (tutti i votanti dei log) per ruolo. */
export function pooledChoices(logs: readonly GameLog[], role: Role): Choice[] {
  const out: Choice[] = [];
  for (const log of logs) for (const p of log.players) out.push(...choicesOf(log.turns, p.id, role, 1));
  return out;
}

export interface PriorFit { prior: OpponentPrior; mode: AdaptMode; sigmaScale: number; lambdaSigma: number; grid: { sigmaScale: number; lambdaSigma: number; logLik: number }[]; choices: { crowd: number; mega: number } }

/**
 * Stima il prior della popolazione dai log di addestramento (MAP con prior debole) e sceglie quanto i singoli possono discostarsene
 * (`sigma` sui coefficienti e `lambdaSigma` sulla scala individuale) cercando i valori che massimizzano la log-verosimiglianza sui log di
 * VALIDAZIONE (partite diverse da quelle di addestramento: nessuna fuga di dati).
 */
export function fitPrior(train: readonly GameLog[], valid: readonly GameLog[], meta: { source: string; seed: number; date: string }, mode: AdaptMode = "types",
  grids: { sigma?: readonly number[]; lambda?: readonly number[]; alpha?: readonly number[] } = {}): PriorFit {
  const weak = new Array<number>(FEATURES.length).fill(3), zero = new Array<number>(FEATURES.length).fill(0);
  const crowdData = pooledChoices(train, "crowd"), megaData = pooledChoices(train, "mega");
  const crowd = fitMAP(crowdData, zero, weak).beta, mega = fitMAP(megaData, zero, weak).beta, round = (v: number[]) => v.map((x) => Math.round(x * 1e4) / 1e4);
  const make = (s: number, l: number): OpponentPrior => ({ version: 1, features: [...FEATURES], crowd: round(crowd), mega: round(mega), sigma: new Array<number>(FEATURES.length).fill(s), lambdaSigma: l,
    fittedOn: { source: meta.source, games: train.length, seed: meta.seed, choices: crowdData.length + megaData.length, date: meta.date } });
  if (mode === "types") {
    // pesi della popolazione sui tipi (λ, ε) con EM sui voti dei giocatori (un tipo per giocatore e partita); pseudo-conteggio scelto sulla validazione
    const players = train.flatMap((l) => l.players.map((p) => ({ crowd: choicesOf(l.turns, p.id, "crowd", 1), mega: choicesOf(l.turns, p.id, "mega", 1) })));
    const g0 = defaultTypeGrid(), grid: PriorFit["grid"] = [];
    let best: { prior: OpponentPrior; alpha: number; ll: number } | null = null;
    for (const alpha of grids.alpha ?? [0.1, 1, 5]) {
      const w = fitTypeWeights(players, crowd, mega, g0, { alpha }).map((x) => Math.round(x * 1e6) / 1e6), prior = { ...make(0.1, 0.5), types: { ...g0, w } };
      const ll = summarizeEval(evaluate(logitPredictor(prior, true, "g", 1, "types"), valid)).logLik.mean; grid.push({ sigmaScale: alpha, lambdaSigma: 0, logLik: ll });
      if (!best || ll > best.ll) best = { prior, alpha, ll };
    }
    return { prior: best!.prior, mode, sigmaScale: best!.alpha, lambdaSigma: 0, grid, choices: { crowd: crowdData.length, mega: megaData.length } };
  }
  const sig = mode === "scale" ? [0.1] : (grids.sigma ?? [0.05, 0.1, 0.2, 0.35, 0.5]), lam = mode === "coef" ? [0.5] : (grids.lambda ?? [0.15, 0.3, 0.5, 0.8, 1.2]);
  const grid: PriorFit["grid"] = [];
  for (const s of sig) for (const l of lam) grid.push({ sigmaScale: s, lambdaSigma: l, logLik: summarizeEval(evaluate(logitPredictor(make(s, l), true, "g", 1, mode), valid)).logLik.mean });
  const best = grid.reduce((b, g) => (g.logLik > b.logLik ? g : b));
  return { prior: make(best.sigmaScale, best.lambdaSigma), mode, sigmaScale: best.sigmaScale, lambdaSigma: best.lambdaSigma, grid, choices: { crowd: crowdData.length, mega: megaData.length } };
}
