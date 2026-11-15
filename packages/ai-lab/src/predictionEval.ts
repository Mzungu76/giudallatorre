import { crowdProbs, learnFromResult, newBotMemory } from "@gdt/game-engine";
import type { BotLevel, GameState, PlayerId } from "@gdt/game-engine";
import { DEFAULT_PRIOR, learnTurn, newOpponentMemory, predictCrowd, predictVotes } from "@gdt/strategic-ai";
import type { AdaptMode, OpponentPrior, TurnContext, TurnData, Who } from "@gdt/strategic-ai";
import { lineupFor } from "./tournament.ts";
import type { TournamentConfig } from "./tournament.ts";
import { playGame } from "./match.ts";
import type { LabContent } from "./match.ts";
import { meanCI, pairedDiff } from "./stats.ts";
import stream from "./rng.ts";

/**
 * Valutazione dei PREDITTORI di voto (Opponent Model / Prediction, Fase 4). Si giocano partite con una popolazione di bot, si registrano i turni
 * conclusi (tutto ciò che è stato rivelato allo spoglio) e poi li si «ri-riproduce» offline: per ogni osservatore e ogni turno, il predittore vede solo
 * ciò che l'osservatore sapeva al momento del voto e prevede i voti degli altri; poi si confronta con i voti veri. Così si possono provare molti
 * predittori e parametri sugli stessi dati, senza rigiocare le partite.
 */
export interface LogPlayer { id: PlayerId; engine: string; level: string; style: string }
export interface GameLog { game: number; seed: number; players: LogPlayer[]; turns: TurnData[] }

/** Dati pubblici di un turno concluso, dallo stato completo (solo per l'analisi: ciò che a quel punto sanno tutti). */
export function turnDataFromState(s: GameState): TurnData {
  const r = s.lastResult!, tower = s.tower.slice().sort((a, b) => a.position - b.position);
  return { n: tower.length, cards: tower.map((t) => t.cardId), phrase: s.phrase?.text ?? null, markPos: s.marks?.[0]?.position ?? null, mega: r.megafonoId,
    votes: { ...r.votes }, owners: tower.map((t) => t.ownerId), fallen: r.fallenPositions.slice(), markType: r.marks[0]?.effect ?? null };
}

/** Gioca i tornei e raccoglie i turni conclusi. */
export function collectLogs(cfg: TournamentConfig, content: LabContent, opts: { onGame?: (done: number, total: number) => void } = {}): GameLog[] {
  const logs: GameLog[] = [];
  for (let g = 0; g < cfg.games; g++) {
    const seed = (cfg.seed + g * 7919) | 0, seats = lineupFor(cfg, seed), turns: TurnData[] = [];
    const row = playGame(seats, g, seed, content, { ...(cfg.miniGame !== undefined ? { miniGame: cfg.miniGame } : {}), onResults: (s) => { turns.push(turnDataFromState(s)); } });
    logs.push({ game: g, seed, players: row.seats.map((s) => ({ id: `p${s.seat}`, engine: s.engine, level: s.level, style: s.style })), turns });
    opts.onGame?.(g + 1, cfg.games);
  }
  return logs;
}

// ---------- predittori ----------
export interface VotePredictorInstance { predict(ctx: TurnContext, who: Who): Record<PlayerId, number[]>; learn(t: TurnData): void }
export interface VotePredictor { id: string; label: string; make(): VotePredictorInstance }

const uniformOf = (ctx: TurnContext, who: Who): Record<PlayerId, number[]> => Object.fromEntries(who.players.filter((p) => p !== who.me).map((p) => [p, new Array<number>(ctx.n).fill(1 / ctx.n)]));

export const uniformPredictor: VotePredictor = { id: "uniforme", label: "Uniforme (a caso)", make: () => ({ predict: uniformOf, learn: () => {} }) };

/** Il modello di «folla» dei bot attuali (`crowdProbs` di ai.ts): stessa distribuzione per tutti, non adatta ai singoli. */
export const productionCrowdPredictor = (level: BotLevel): VotePredictor => ({
  id: `folla-bot-${level}`, label: `Modello di folla dei bot attuali (${level})`,
  make: () => {
    const bm = newBotMemory();
    return {
      predict: (ctx, who) => {
        const pseudo = { tower: ctx.cards.map((c, i) => ({ position: i + 1, cardId: c, ownerId: null })), phrase: ctx.phrase ? { text: ctx.phrase } : null } as unknown as GameState;
        const p = crowdProbs(pseudo, bm, level);
        return Object.fromEntries(who.players.filter((q) => q !== who.me).map((q) => [q, p.slice()]));
      },
      learn: (t) => { const tower = t.cards.map((c) => ({ cardId: c })); learnFromResult(bm, tower, { fallenCardIds: t.fallen.map((f) => t.cards[f - 1]!), fallenCardId: t.cards[(t.fallen[0] ?? 1) - 1]! } as never); },
    };
  },
});

/** Opponent Model logit: `adapt = false` usa solo il prior della popolazione; `true` adatta i coefficienti a ogni giocatore con ciò che ha votato nei turni passati. */
export const logitPredictor = (prior: OpponentPrior = DEFAULT_PRIOR, adapt = true, id = adapt ? "modello-adattivo" : "modello-popolazione", decay = 1, mode: AdaptMode = "types", table = 0, floor = 0): VotePredictor => ({
  id, label: adapt ? "Opponent Model (prior + adattamento per giocatore)" : "Opponent Model (solo prior della popolazione)",
  make: () => { const mem = newOpponentMemory(); return { predict: (ctx, who) => predictVotes(mem, ctx, who, { prior, adapt, decay, mode, table, floor }), learn: (t) => learnTurn(mem, t) }; },
});

// ---------- valutazione ----------
export interface Obs {
  game: number; observer: PlayerId; turn: number; /** turno nella partita (0 = primo): quanti dati ha il modello sul votante */ voter: PlayerId; role: "crowd" | "mega";
  level: string; style: string; n: number; logp: number; /** 1 se l'opzione più probabile è quella votata; con pareggi tra le più probabili si divide in parti uguali. */ hit: number; p: number;
}
export interface CrowdObs { turn: number; n: number; others: number; leadMass: number; conv: number[]; actualMax: number }
export interface Evaluation { predictor: string; obs: Obs[]; crowd: CrowdObs[] }

/** Ri-riproduce i log con un predittore. Ogni giocatore fa da osservatore: il predittore vede ciò che sapeva lui (la posizione della propria carta, il segnalino) e prevede gli altri. */
export function evaluate(pred: VotePredictor, logs: readonly GameLog[], opts: { crowdSamples?: number; seed?: number } = {}): Evaluation {
  const obs: Obs[] = [], crowd: CrowdObs[] = [], rand = stream((opts.seed ?? 1) ^ 0x1234567);
  for (const log of logs) {
    const ids = log.players.map((p) => p.id), info = new Map(log.players.map((p) => [p.id, p]));
    for (const me of ids) {
      const inst = pred.make();
      log.turns.forEach((t, ti) => {
        const myPos = t.owners.findIndex((o) => o === me) + 1, who: Who = { me, mega: t.mega, myPos: myPos || null, players: ids }, preds = inst.predict(t, who);
        const counts = new Array<number>(t.n + 1).fill(0);
        for (const p of ids) {
          if (p === me) continue;
          const v = t.votes[p]!, pr = preds[p]!; counts[v]!++;
          const best = pr.reduce((m, x) => Math.max(m, x), 0), tied = pr.filter((x) => x >= best - 1e-12).length, hit = pr[v - 1]! >= best - 1e-12 ? 1 / tied : 0;
          obs.push({ game: log.game, observer: me, turn: ti, voter: p, role: p === t.mega ? "mega" : "crowd", level: info.get(p)!.level, style: info.get(p)!.style, n: t.n, logp: Math.log(Math.max(pr[v - 1]!, 1e-12)), hit, p: pr[v - 1]! });
        }
        const cr = predictCrowd(preds, rand, opts.crowdSamples ?? 200), top = Math.max(...counts.slice(1)), actual: number[] = []; for (let k = 1; k <= t.n; k++) if (counts[k] === top) actual.push(k);
        crowd.push({ turn: ti, n: t.n, others: ids.length - 1, leadMass: actual.reduce((a, k) => a + cr.lead[k - 1]!, 0), conv: cr.conv, actualMax: top });
        inst.learn(t);
      });
    }
  }
  return { predictor: pred.id, obs, crowd };
}

export interface EvalSummary { predictor: string; n: number; logLik: ReturnType<typeof meanCI>; accuracy: ReturnType<typeof meanCI>; leadMass: ReturnType<typeof meanCI> }
export function summarizeEval(e: Evaluation, filter: (o: Obs) => boolean = () => true): EvalSummary {
  const o = e.obs.filter(filter);
  return { predictor: e.predictor, n: o.length, logLik: meanCI(o.map((x) => x.logp)), accuracy: meanCI(o.map((x) => x.hit)), leadMass: meanCI(e.crowd.map((c) => c.leadMass)) };
}
/** Differenza di log-verosimiglianza appaiata A−B sulle STESSE osservazioni (positivo = A prevede meglio). */
export function compareEval(a: Evaluation, b: Evaluation, filter: (o: Obs) => boolean = () => true) {
  const xa: number[] = [], xb: number[] = [];
  a.obs.forEach((o, i) => { if (filter(o)) { xa.push(o.logp); xb.push(b.obs[i]!.logp); } });
  return pairedDiff(xa, xb);
}
/** Calibrazione della convergenza: previsto vs osservato di P(almeno m degli altri votano la stessa carta), per m = 2.. */
export function convergenceCalibration(e: Evaluation, ms: readonly number[] = [2, 3, 4]) {
  return ms.map((m) => { const c = e.crowd.filter((x) => x.others >= m); return { m, n: c.length, predicted: c.reduce((a, x) => a + (x.conv[m] ?? 0), 0) / Math.max(1, c.length), actual: c.reduce((a, x) => a + (x.actualMax >= m ? 1 : 0), 0) / Math.max(1, c.length) }; });
}
