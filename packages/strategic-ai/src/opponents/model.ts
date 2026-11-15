import { affinity, tallyMarks } from "@gdt/game-engine";
import type { Observation, PlayerId } from "@gdt/game-engine";
import { choiceProbs, dot, fitMAP } from "./logit.ts";
import type { Choice, Fit } from "./logit.ts";
import { DEFAULT_PRIOR } from "./prior.ts";
import { defaultTypeGrid, describeTypes, typeLogLiks, typePosterior } from "./types.ts";
import type { OpponentPrior } from "./prior.ts";

/**
 * Opponent Model + Prediction (Fase 4). Per ogni avversario si stima, da ciò che ha votato nei turni già conclusi, un vettore β di preferenze
 * (quanto pesa l'affinità carta↔frase, il segnalino, la propria carta, le posizioni di bordo). La previsione del voto è la risposta quantale
 * (logit) con quei coefficienti: `P(vota k) ∝ exp(β·x_k)`. I coefficienti partono da un prior della popolazione (`OpponentPrior`) e si
 * adattano al singolo giocatore con stima MAP: con pochi dati restano vicini al prior (nessuna «personalità» da due osservazioni), con più dati se ne allontanano.
 * Usa solo informazioni pubbliche: ciò che è visibile al voto e ciò che è stato rivelato allo spoglio dei turni precedenti.
 */
export const FEATURES = ["aff", "top", "mark", "own", "first", "last"] as const;
export const D = FEATURES.length;
const OWN = FEATURES.indexOf("own");
/** Come si adattano i coefficienti a un giocatore: `coef` = ogni coefficiente libero (prior gaussiano); `scale` = una sola scala λ che rende il giocatore più o meno netto (β = λ·β_popolazione, come nella risposta quantale); `scale+coef` = scala più piccole deviazioni. */
export type AdaptMode = "coef" | "scale" | "scale+coef" | "types";

/** Ciò che si sa di un turno al momento del voto. */
export interface TurnContext { n: number; /** Personaggio in ogni posizione (indice = posizione − 1). */ cards: string[]; phrase: string | null; /** Posizione del segnalino (non il tipo), se già posato. */ markPos: number | null }
/** Un turno concluso: tutto è stato rivelato. */
export interface TurnData extends TurnContext {
  mega: PlayerId; votes: Record<PlayerId, number>; /** owners[posizione − 1] = chi aveva giocato quella carta. */ owners: (PlayerId | null)[];
  fallen: number[]; markType: string | null;
}
export interface OpponentMemory { turns: TurnData[] }
export const newOpponentMemory = (): OpponentMemory => ({ turns: [] });
export const learnTurn = (m: OpponentMemory, t: TurnData, cap = 60): void => { m.turns.push(t); if (m.turns.length > cap) m.turns.splice(0, m.turns.length - cap); };

export type Role = "crowd" | "mega";
/** Peso predefinito del tipo di tavolo (κ): moderato. Misurato in docs/AI_BENCHMARKS.md §5: aiuta nei tavoli omogenei, è neutro nei tavoli misti. */
export const DEFAULT_TABLE_WEIGHT = 4;

/** Caratteristiche delle n opzioni (posizioni) per un votante; `ownPos` = posizione della sua carta (null se non nota). */
export function optionFeatures(ctx: TurnContext, ownPos: number | null): number[][] {
  const n = ctx.n, raw = ctx.phrase ? ctx.cards.map((c) => affinity(c, ctx.phrase!)) : [], ok = raw.length === n && raw.every((a) => a !== null);
  const mean = ok ? (raw as number[]).reduce((a, b) => a + b, 0) / n : 0;
  const best = ok ? Math.max(...(raw as number[])) : 0, nTop = ok ? (raw as number[]).filter((a) => a === best).length : 1;
  return Array.from({ length: n }, (_, i) => [ok ? (raw[i] as number) - mean : 0, ok && best > 0 && raw[i] === best ? 1 / nTop : 0, ctx.markPos === i + 1 ? 1 : 0, ownPos === i + 1 ? 1 : 0, i === 0 ? 1 : 0, i === n - 1 ? 1 : 0]);
}

/** Dati di addestramento di un giocatore nel ruolo dato: una scelta per ogni turno passato in cui ha votato in quel ruolo. `decay`: peso per turno di età (1 = nessuno). */
export function choicesOf(turns: readonly TurnData[], player: PlayerId, role: Role, decay = 1): Choice[] {
  const out: Choice[] = [];
  turns.forEach((t, idx) => {
    const v = t.votes[player]; if (v === undefined || (t.mega === player) !== (role === "mega")) return;
    const own = t.owners.findIndex((o) => o === player) + 1;
    out.push({ x: optionFeatures(t, own || null), y: v - 1, w: decay ** (turns.length - 1 - idx) });
  });
  return out;
}

export const priorMean = (p: OpponentPrior, role: Role): number[] => (role === "mega" ? p.mega : p.crowd);

/** Posteriore (MAP + Laplace) dei coefficienti di un giocatore: `beta` sono i coefficienti effettivi, `lambda` la scala stimata (1 = come la popolazione, < 1 più casuale, > 1 più netto). */
export function posterior(mem: OpponentMemory, player: PlayerId, role: Role, prior: OpponentPrior = DEFAULT_PRIOR, decay = 1, mode: "coef" | "scale" | "scale+coef" = "scale+coef"): Fit & { lambda: number } {
  const data = choicesOf(mem.turns, player, role, decay), mu = priorMean(prior, role);
  if (mode === "coef") { const f = fitMAP(data, mu, prior.sigma); return { ...f, lambda: 1 }; }
  const aug = data.map((c) => ({ ...c, x: c.x.map((r) => [dot(r, mu), ...(mode === "scale+coef" ? r : [])]) }));
  const f = fitMAP(aug, [1, ...(mode === "scale+coef" ? new Array<number>(D).fill(0) : [])], [prior.lambdaSigma, ...(mode === "scale+coef" ? prior.sigma : [])]);
  const lam = f.beta[0]!, beta = mu.map((m, i) => lam * m + (mode === "scale+coef" ? f.beta[1 + i]! : 0));
  return { beta, sd: f.sd.slice(0, 1).concat(new Array<number>(D - 1).fill(NaN)), n: f.n, nll: f.nll, lambda: lam };
}

export interface Who { me: PlayerId; mega: PlayerId; /** Posizione della mia carta, se la so (le carte altrui sono di chiunque tranne me). */ myPos: number | null; players: readonly PlayerId[] }
export interface PredictOptions { prior?: OpponentPrior; /** Se false si usa il prior della popolazione senza adattare al singolo. */ adapt?: boolean; decay?: number; mode?: AdaptMode;
  /** Modalità `types`: peso (in «giocatori equivalenti») del tipo di TAVOLO. 0 = ogni giocatore parte dal prior della popolazione; > 0 = parte da un mix tra la popolazione e ciò che si è visto negli altri avversari (un tavolo di principianti o di esperti). */ table?: number }

/**
 * Probabilità che ciascun altro giocatore voti ognuna delle posizioni (indice = posizione − 1). La posizione della carta del votante non è nota:
 * è una a caso tra quelle che non sono la mia, e la previsione è la media su queste possibilità.
 */
export function predictVotes(mem: OpponentMemory, ctx: TurnContext, who: Who, opts: PredictOptions = {}): Record<PlayerId, number[]> {
  const prior = opts.prior ?? DEFAULT_PRIOR, out: Record<PlayerId, number[]> = {}, n = ctx.n;
  const owners: number[] = []; for (let k = 1; k <= n; k++) if (k !== who.myPos) owners.push(k);
  const base = optionFeatures(ctx, null);
  const mode = opts.mode ?? "types", grid = prior.types ?? defaultTypeGrid(), kappa = opts.table ?? DEFAULT_TABLE_WEIGHT, others = who.players.filter((q) => q !== who.me);
  // verosimiglianze dei tipi per ogni avversario (servono anche per stimare il tipo di tavolo)
  const lls = new Map<PlayerId, number[]>(), pops = new Map<PlayerId, number[]>();
  if (opts.adapt !== false && mode === "types") for (const q of others) {
    const l = typeLogLiks(choicesOf(mem.turns, q, "crowd", opts.decay ?? 1), choicesOf(mem.turns, q, "mega", opts.decay ?? 1), prior.crowd, prior.mega, grid); lls.set(q, l); pops.set(q, typePosterior(grid, l));
  }
  for (const p of who.players) {
    if (p === who.me) continue;
    const role: Role = p === who.mega ? "mega" : "crowd", acc = new Array<number>(n).fill(0);
    const withOwn = (o: number) => base.map((r, i) => (i === o - 1 ? r.map((v, j) => (j === OWN ? 1 : v)) : r));
    if (opts.adapt !== false && mode === "types") {
      // distribuzione sui tipi (λ, ε) aggiornata con i voti già visti; previsione = miscela dei tipi
      let tableGrid = grid;
      if (kappa > 0 && others.length > 1) {   // prior del giocatore = popolazione (peso κ) + posteriori degli ALTRI avversari (uno per giocatore)
        const w = grid.w.map((x) => kappa * x); for (const q of others) if (q !== p) pops.get(q)!.forEach((v, i) => { w[i]! += v; });
        const z = w.reduce((a, b) => a + b, 0); tableGrid = { ...grid, w: w.map((v) => v / z) };
      }
      const post = typePosterior(tableGrid, lls.get(p)!), beta = priorMean(prior, role), E = grid.eps.length;
      for (const o of owners) {
        const x = withOwn(o);
        grid.lambda.forEach((lam, li) => { const sm = choiceProbs(x, beta.map((b) => b * lam)); for (let ei = 0; ei < E; ei++) { const w = post[li * E + ei]! / owners.length, eps = grid.eps[ei]!; if (w < 1e-12) continue; for (let i = 0; i < n; i++) acc[i]! += w * (eps / n + (1 - eps) * sm[i]!); } });
      }
    } else {
      const beta = opts.adapt === false ? priorMean(prior, role) : posterior(mem, p, role, prior, opts.decay ?? 1, mode === "types" ? "scale+coef" : mode).beta;
      for (const o of owners) { const pr = choiceProbs(withOwn(o), beta); for (let i = 0; i < n; i++) acc[i]! += pr[i]! / owners.length; }
    }
    out[p] = acc;
  }
  return out;
}

/** Che tipo sembra un giocatore, dai voti già visti: λ ed ε attesi, incertezza residua e numero di voti usati. */
export function describePlayer(mem: OpponentMemory, player: PlayerId, prior: OpponentPrior = DEFAULT_PRIOR, decay = 1) {
  const grid = prior.types ?? defaultTypeGrid(), crowd = choicesOf(mem.turns, player, "crowd", decay), mega = choicesOf(mem.turns, player, "mega", decay);
  return { ...describeTypes(grid, typePosterior(grid, typeLogLiks(crowd, mega, prior.crowd, prior.mega, grid))), votes: crowd.length + mega.length };
}

// ---------- adattatori dall'osservazione ----------
export function contextOf(o: Observation): TurnContext {
  const tower = o.tower.slice().sort((a, b) => a.position - b.position);
  return { n: tower.length, cards: tower.map((t) => t.cardId), phrase: o.phrase?.text ?? null, markPos: o.marks[0]?.position ?? null };
}
export const whoOf = (o: Observation): Who => ({ me: o.viewerId, mega: o.megafonoId, myPos: o.myCard?.position ?? null, players: o.players.map((p) => p.id) });

/** Turno concluso da un'osservazione in fase RESULTS (tutto rivelato). `null` se il turno non è ancora concluso o è un intervallo. */
export function turnDataOf(o: Observation): TurnData | null {
  const r = o.lastResult; if (o.phase !== "RESULTS" || !r || !o.votes) return null;
  const tower = o.tower.slice().sort((a, b) => a.position - b.position);
  return { ...contextOf(o), mega: o.megafonoId, votes: { ...r.votes }, owners: tower.map((t) => t.ownerId), fallen: r.fallenPositions.slice(), markType: r.marks[0]?.effect ?? null };
}

// ---------- caduta e convergenza ----------
/** Estrae una posizione da una distribuzione. */
const sample = (p: readonly number[], rand: () => number): number => { let u = rand(); for (let k = 0; k < p.length; k++) { u -= p[k]!; if (u <= 0) return k + 1; } return p.length; };

/**
 * Previsione sul voto degli ALTRI nel loro insieme (indipendenti dati i coefficienti): probabilità che ogni posizione sia la più votata tra gli altri,
 * e che almeno `m` altri convergano sulla stessa carta (m = 2..). `samples` estrazioni; `rand` dall'esterno (ripetibile).
 */
export function predictCrowd(marginals: Record<PlayerId, number[]>, rand: () => number, samples = 400) {
  const players = Object.keys(marginals), n = players.length ? marginals[players[0]!]!.length : 0, lead = new Array<number>(n).fill(0), conv = new Array<number>(players.length + 2).fill(0);
  for (let s = 0; s < samples; s++) {
    const c = new Array<number>(n + 1).fill(0); for (const p of players) c[sample(marginals[p]!, rand)]!++;
    const top = Math.max(...c.slice(1)), tied = []; for (let k = 1; k <= n; k++) if (c[k] === top) tied.push(k);
    for (const k of tied) lead[k - 1]! += 1 / tied.length / samples;
    for (let m = 1; m <= top; m++) conv[m]! += 1 / samples;
  }
  return { lead, /** conv[m] = P(max voti su una carta tra gli altri ≥ m) */ conv };
}

/** Probabilità che ogni posizione CADA, tipo di segnalino ignoto: si estrae uniforme tra cade / non cade / voti nulli (o si usa quello noto). Voti degli altri dal modello; il mio voto è `myVote` (o assente). */
export function predictFall(marginals: Record<PlayerId, number[]>, markPos: number | null, rand: () => number, opts: { samples?: number; markType?: string | null; myVote?: { player: PlayerId; position: number } } = {}): number[] {
  const players = Object.keys(marginals), n = players.length ? marginals[players[0]!]!.length : 0, S = opts.samples ?? 400, fall = new Array<number>(n).fill(0), pos = Array.from({ length: n }, (_, i) => i + 1);
  for (let s = 0; s < S; s++) {
    const votes: Record<string, number> = {}; for (const p of players) votes[p] = sample(marginals[p]!, rand);
    if (opts.myVote) votes[opts.myVote.player] = opts.myVote.position;
    const type = opts.markType ?? (["cade", "noncade", "nulli"] as const)[Math.floor(rand() * 3)]!;
    const T = tallyMarks(pos, votes, markPos ? [{ effect: type, position: markPos }] : []);
    for (const f of T.fallen) fall[f - 1]! += 1 / S;
  }
  return fall;
}
