import { affinity, legalActions, phraseTagCount, scoreTurn } from "@gdt/game-engine";
import type { Action, Observation, PlayerId } from "@gdt/game-engine";
import type { DecisionContext, StrategicEngine } from "../api.ts";
import { FITTED_PRIOR } from "../opponents/prior.ts";
import { contextOf, learnTurn, newOpponentMemory, predictVotes, turnDataOf, whoOf } from "../opponents/model.ts";
import type { OpponentMemory, TurnContext } from "../opponents/model.ts";
import type { OpponentPrior } from "../opponents/prior.ts";
import { evaluateCandidates, phi, sampleFrom, softmaxPick } from "../sim/montecarlo.ts";

/**
 * Primo motore strategico (Fase 5). Decide solo dall'osservazione. Per segnalino e voto:
 *  1. prevede i voti degli altri con l'Opponent Model (Fase 4);
 *  2. simula il turno (Monte Carlo con numeri casuali comuni) per ogni mia scelta, con le regole ufficiali (`scoreTurn`);
 *  3. sceglie con una strategia mista (softmax) sul valore, non sempre la prima.
 * Obiettivo (`objective`): `points` = punti attesi (Megafono: vantaggio sulla media degli altri); `win` = probabilità di vincere la partita
 * (stima dal distacco di punteggio con un'incertezza che dipende dai turni che restano). Frase e carta da giocare usano l'affinità, come i bot attuali:
 * il contributo da misurare è quello di previsione + simulazione.
 */
export interface StrategicConfig {
  id: string; label: string; objective: "points" | "win";
  /** Simulazioni per decisione (massimo), minimo prima dell'arresto anticipato e soglia z dell'arresto. */ samples: number; minSamples: number; earlyStopZ: number;
  /** Temperatura della scelta mista (0 = sempre il migliore). Unità: punti (points) o probabilità (win). */ tau: number;
  /** Bluff: bonus (in punti) per il tipo di segnalino meno atteso dal tavolo (−log della frequenza osservata dei tipi in questa partita). 0 = nessun bluff. */ bluff: number;
  /** Distribuzione dei tipi di segnalino che il tavolo si aspetta (cade, noncade, nulli): chi se ne discosta guadagna il bonus di bluff. */ expectedMix: [number, number, number];
  /** Se vero, chi vota stima il tipo del segnalino altrui dalle frequenze viste al tavolo (con `expectedMix` come prior) invece di assumerlo uniforme. */ learnTypes: boolean;
  /** Temperatura della scelta mista del segnalino (può essere maggiore di `tau`: il segnalino è la scelta che più rivela il bot). */ tauMark: number;
  /** Prior dell'Opponent Model (default: quello stimato dal laboratorio). */ prior?: OpponentPrior;
  /** Incertezza residua del distacco in classifica: √(sigma0² + turniRimasti·sigmaTurn²). */ sigma0: number; sigmaTurn: number;
}
export const DEFAULT_STRATEGIC: Omit<StrategicConfig, "id" | "label" | "objective" | "tau"> = { bluff: 0, learnTypes: false, expectedMix: [0.5, 0.25, 0.25], tauMark: 0.05, samples: 120, minSamples: 40, earlyStopZ: 3, sigma0: 2, sigmaTurn: 3 };

interface Mem { opp: OpponentMemory }
const TYPES = ["cade", "noncade", "nulli"] as const;

export function makeStrategicEngine(cfg: StrategicConfig): StrategicEngine<Mem> {
  return {
    id: cfg.id, label: cfg.label,
    newMemory: () => ({ opp: newOpponentMemory() }),
    learn: (m, obs) => { const t = turnDataOf(obs); if (t) learnTurn(m.opp, t); },
    decide: (m, obs, ctx) => decide(cfg, m, obs, ctx),
  };
}

function decide(cfg: StrategicConfig, mem: Mem, obs: Observation, ctx: DecisionContext): Action | null {
  const legal = legalActions(obs); if (!legal.length) return null;
  const me = obs.viewerId;
  switch (obs.phase) {
    case "PROCLAIM": {
      const c = obs.proclaimCard!, tags = c.phrases.map(phraseTagCount), best = Math.max(...tags), top = tags.flatMap((v, i) => (v === best ? [i] : []));
      return { type: "choosePhrase", playerId: me, mode: "card", index: top[Math.floor(ctx.rand() * top.length)]! };
    }
    case "PLAY": {
      const text = obs.phrase?.text, score = (c: string) => (text ? affinity(c, text) ?? 0 : 0) + ctx.rand() * 0.6;
      return { type: "playCard", playerId: me, cardId: obs.myHand.slice().sort((a, b) => score(b) - score(a))[0]! };
    }
    case "SUSPECT": return placeMark(cfg, mem, obs, ctx);
    case "VOTE": return castVote(cfg, mem, obs, ctx);
    default: return legal[Math.floor(ctx.rand() * legal.length)]!;   // intervallo: scelta a caso (non ancora modellato)
  }
}

/** La Torre come la vedo io: dei proprietari conosco solo il mio. */
const myTower = (obs: Observation) => obs.tower.map((t) => ({ position: t.position, cardId: t.cardId, ownerId: obs.myCard?.position === t.position ? obs.viewerId : null }));

/** Utilità di un esito: punti (Megafono: vantaggio sulla media degli altri) oppure probabilità di vincere. */
function utility(cfg: StrategicConfig, obs: Observation, points: Record<PlayerId, number>): number {
  const me = obs.viewerId, mega = obs.megafonoId, others = obs.players.filter((p) => p.id !== me);
  if (cfg.objective === "points") return me === mega ? points[me]! - others.reduce((a, p) => a + points[p.id]!, 0) / Math.max(1, others.length) : points[me]!;
  const left = Math.max(0, obs.totalTurns - obs.turn), sigma = Math.sqrt(cfg.sigma0 ** 2 + left * cfg.sigmaTurn ** 2), mine = obs.players.find((p) => p.id === me)!.score + points[me]!;
  let pw = 1; for (const o of others) pw *= phi((mine - (o.score + points[o.id]!)) / sigma);
  return pw + 0.001 * points[me]!;   // il secondo termine rompe i pareggi tra scelte quasi equivalenti
}

const deadline = (ctx: DecisionContext) => (ctx.budgetMs !== undefined ? { deadlineMs: ctx.budgetMs } : {});

function placeMark(cfg: StrategicConfig, mem: Mem, obs: Observation, ctx: DecisionContext): Action {
  const me = obs.viewerId, n = obs.tower.length, ids = obs.players.map((p) => p.id), others = ids.filter((p) => p !== me), base = contextOf(obs), who = whoOf(obs), tower = myTower(obs);
  const marg: Record<PlayerId, number[]>[] = [];   // previsione dei voti degli altri per ogni posizione candidata del segnalino
  for (let pos = 1; pos <= n; pos++) marg[pos] = predictVotes(mem.opp, { ...base, markPos: pos } as TurnContext, who, { prior: cfg.prior ?? FITTED_PRIOR });
  const cands: { pos: number; type: string; vote: number }[] = [];
  for (let pos = 1; pos <= n; pos++) for (const type of TYPES) for (let v = 1; v <= n; v++) if (!(type === "nulli" && v === pos)) cands.push({ pos, type, vote: v });
  const res = evaluateCandidates(cands.length, () => others.map(() => ctx.rand()), (c, u) => {
    const k = cands[c]!, votes: Record<PlayerId, number> = { [me]: k.vote };
    others.forEach((p, j) => { votes[p] = sampleFrom(marg[k.pos]![p]!, u[j]!); });
    return utility(cfg, obs, scoreTurn(tower, ids, me, votes, [{ slot: k.type, effect: k.type, position: k.pos }], false).points);
  }, { samples: cfg.samples, minSamples: cfg.minSamples, earlyStopZ: cfg.earlyStopZ, ...deadline(ctx) });
  // per ogni (posizione, tipo) vale il mio miglior voto; poi scelta mista tra le 3n combinazioni
  const best = new Map<string, number>(); cands.forEach((k, i) => { const key = `${k.pos}:${k.type}`; best.set(key, Math.max(best.get(key) ?? -Infinity, res.means[i]!)); });
  // bluff: bonus per il tipo di segnalino che il tavolo si aspetta di meno (frequenze dei tipi già visti in questa partita, con prior 50/25/25)
  const seen = mem.opp.turns.map((t) => t.markType).filter((t): t is string => !!t), prior0: Record<string, number> = { cade: cfg.expectedMix[0], noncade: cfg.expectedMix[1], nulli: cfg.expectedMix[2] };
  const surprise = (type: string) => -Math.log(((prior0[type] ?? 0.25) * 2 + seen.filter((t) => t === type).length) / (2 + seen.length));
  const keys = [...best.keys()], pick = keys[softmaxPick(keys.map((k) => best.get(k)! + cfg.bluff * surprise(k.split(":")[1]!)), cfg.tauMark, ctx.rand)]!, [pos, type] = pick.split(":");
  return { type: "placeMarks", playerId: me, marks: [{ slot: type!, position: Number(pos) }] };
}

function castVote(cfg: StrategicConfig, mem: Mem, obs: Observation, ctx: DecisionContext): Action {
  const me = obs.viewerId, mega = obs.megafonoId, n = obs.tower.length, ids = obs.players.map((p) => p.id), others = ids.filter((p) => p !== me), tower = myTower(obs);
  const markPos = obs.marks[0]?.position ?? null, knownType = obs.marks[0]?.slot ?? null, forbidden = obs.myForbidden;
  const marg = predictVotes(mem.opp, contextOf(obs), whoOf(obs), { prior: cfg.prior ?? FITTED_PRIOR });
  const cands: number[] = []; for (let v = 1; v <= n; v++) if (v !== forbidden) cands.push(v);
  // credenza sul tipo del segnalino altrui: uniforme, oppure (learnTypes) frequenze viste al tavolo con `expectedMix` come prior (2 osservazioni di peso)
  const seen = mem.opp.turns.map((t) => t.markType), belief = cfg.learnTypes ? TYPES.map((ty, i) => (cfg.expectedMix[i]! * 2 + seen.filter((x) => x === ty).length) / (2 + seen.length)) : [1 / 3, 1 / 3, 1 / 3];
  const res = evaluateCandidates(cands.length, () => ({ u: others.map(() => ctx.rand()), t: sampleFrom(belief, ctx.rand()) - 1 }), (c, w: { u: number[]; t: number }) => {
    const type = knownType ?? TYPES[w.t]!, votes: Record<PlayerId, number> = { [me]: cands[c]! };
    others.forEach((p, j) => { let v = sampleFrom(marg[p]!, w.u[j]!); if (p === mega && type === "nulli" && v === markPos) v = (v % n) + 1; votes[p] = v; });   // il Megafono non vota la carta annullata
    return utility(cfg, obs, scoreTurn(tower, ids, mega, votes, markPos ? [{ slot: type, effect: type, position: markPos }] : [], false).points);
  }, { samples: cfg.samples, minSamples: cfg.minSamples, earlyStopZ: cfg.earlyStopZ, ...deadline(ctx) });
  return { type: "vote", playerId: me, position: cands[softmaxPick(res.means, cfg.tau, ctx.rand)]! };
}

/** Configurazione «massima forza»: nessun bluff, credenza uniforme sul tipo. Contro i bot attuali vince di più, ma gioca quasi sempre CADE sulla propria carta (comportamento prevedibile). */
export const strategicMax = makeStrategicEngine({ id: "strategic-max-0.1", label: "Strategico 0.1 (massima forza, prevedibile)", objective: "points", tau: 0.05, ...DEFAULT_STRATEGIC });

/** Le due varianti da misurare: stessa previsione e simulazione, obiettivo diverso. */
export const strategicPts = makeStrategicEngine({ id: "strategic-pts-0.1", label: "Strategico 0.1 (punti attesi)", objective: "points", tau: 0.05, ...DEFAULT_STRATEGIC, bluff: 1, expectedMix: [0.4, 0.15, 0.45], tauMark: 0.3, learnTypes: true });
export const strategicWin = makeStrategicEngine({ id: "strategic-win-0.1", label: "Strategico 0.1 (probabilità di vittoria)", objective: "win", tau: 0.001, ...DEFAULT_STRATEGIC, sigma0: 8, sigmaTurn: 8 });
