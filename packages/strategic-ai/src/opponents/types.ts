import { dot, softmax } from "./logit.ts";
import type { Choice } from "./logit.ts";

/**
 * Ragionamento per tipi (Albrecht & Stone 2018) con risposta quantale (McKelvey & Palfrey 1995): ogni giocatore ha un TIPO (λ, ε, μ)
 *   P(vota k) = ε/n + (1 − ε) · softmax_k(λ · β'·x),   β' = β con il peso del segnalino moltiplicato per μ
 * λ = quanto è netto nel seguire gli indizi (0 = li ignora, 1 = come la popolazione), ε = quanto spesso vota a caso («mano che trema»),
 * μ = quanto si fida del segnalino (0 = lo ignora, 1 = come la popolazione): distingue chi segue il segnalino da chi è scettico.
 * Il tipo non si osserva: si tiene una DISTRIBUZIONE sui tipi (griglia), che parte dai pesi della popolazione e si aggiorna col teorema di Bayes
 * a ogni voto visto. Con pochi voti la distribuzione resta larga (nessuna «personalità» da due osservazioni); con più voti si stringe.
 * I pesi della popolazione si stimano dai dati con EM (`fitTypeWeights`), quindi riflettono le persone realmente osservate.
 */
export interface TypeGrid { lambda: number[]; eps: number[]; /** Fiducia nel segnalino; assente = [1] (file di prior più vecchi). */ mu?: number[]; /** Nettezza sull'affinità carta↔frase (moltiplica `aff`); assente = [1]. */ alpha?: number[]; /** Pesi a priori, indice = ((li·E + ei)·M + mi)·A + ai; sommano 1. */ w: number[] }

/** Indice della caratteristica «segnalino» nei vettori di coefficienti (vedi FEATURES in model.ts: aff, top, mark, …). */
export const MARK_IDX = 2;
/** Indice di `aff` (solo l'affinità lineare: `top` non viene scalata). */
export const AFF_IDX = [0];
export const muOf = (g: TypeGrid): number[] => g.mu ?? [1];
export const alphaOf = (g: TypeGrid): number[] => g.alpha ?? [1];

export function defaultTypeGrid(): TypeGrid {
  const lambda = [0.25, 0.5, 1, 1.5, 2.5], eps = [0, 0.25, 0.5], mu = [0, 0.4, 1], alpha = [1, 3, 8], n = lambda.length * eps.length * mu.length * alpha.length;
  return { lambda, eps, mu, alpha, w: new Array<number>(n).fill(1 / n) };
}
export const typeCount = (g: TypeGrid): number => g.lambda.length * g.eps.length * muOf(g).length * alphaOf(g).length;
export const typeOf = (g: TypeGrid, i: number): { lambda: number; eps: number; mu: number; alpha: number } => {
  const M = muOf(g), A = alphaOf(g), E = g.eps.length, a = i % A.length, r = Math.floor(i / A.length);
  return { lambda: g.lambda[Math.floor(r / (E * M.length))]!, eps: g.eps[Math.floor(r / M.length) % E]!, mu: M[r % M.length]!, alpha: A[a]! };
};
/** β con il peso del segnalino scalato di μ e quello dell'affinità di α. */
export const scaledBeta = (beta: readonly number[], mu: number, alpha = 1): number[] => (mu === 1 && alpha === 1 ? beta.slice() : beta.map((b, j) => (j === MARK_IDX ? b * mu : AFF_IDX.includes(j) ? b * alpha : b)));

/** Probabilità di scelta di un tipo. */
export function mixProbs(x: readonly (readonly number[])[], beta: readonly number[], lambda: number, eps: number, mu = 1, alpha = 1): number[] {
  const b = scaledBeta(beta, mu, alpha), p = softmax(x.map((r) => lambda * dot(r, b))), n = p.length;
  return p.map((v) => eps / n + (1 - eps) * v);
}

/** Log-verosimiglianza dei voti osservati di un giocatore sotto ciascun tipo (pesata dal decadimento). */
export function typeLogLiks(crowd: readonly Choice[], mega: readonly Choice[], betaCrowd: readonly number[], betaMega: readonly number[], g: TypeGrid): number[] {
  const out = new Array<number>(typeCount(g)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const { lambda, eps, mu, alpha } = typeOf(g, i); let s = 0;
    for (const c of crowd) s += c.w * Math.log(Math.max(mixProbs(c.x, betaCrowd, lambda, eps, mu, alpha)[c.y]!, 1e-300));
    for (const c of mega) s += c.w * Math.log(Math.max(mixProbs(c.x, betaMega, lambda, eps, mu, alpha)[c.y]!, 1e-300));
    out[i] = s;
  }
  return out;
}

/** Distribuzione a posteriori sui tipi: pesi a priori × verosimiglianza, normalizzata. */
export function typePosterior(g: TypeGrid, logLiks: readonly number[]): number[] {
  const lw = g.w.map((w, i) => Math.log(Math.max(w, 1e-300)) + logLiks[i]!), m = Math.max(...lw), e = lw.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}

/** Sintesi di una distribuzione sui tipi: λ, ε e μ attesi e quanto è ancora incerta (entropia normalizzata: 1 = nessuna informazione, 0 = certezza). */
export function describeTypes(g: TypeGrid, post: readonly number[]) {
  let lam = 0, eps = 0, mu = 0, al = 0, h = 0; post.forEach((p, i) => { const t = typeOf(g, i); lam += p * t.lambda; eps += p * t.eps; mu += p * t.mu; al += p * t.alpha; if (p > 0) h -= p * Math.log(p); });
  return { lambda: lam, eps, mu, alpha: al, uncertainty: h / Math.log(post.length) };
}

/**
 * Stima EM dei pesi della popolazione sui tipi: ogni giocatore (di ogni partita) ha un tipo fisso per tutti i suoi voti; si massimizza la
 * verosimiglianza dei voti osservati. `alpha` = pseudo-conteggio di Dirichlet (regolarizzazione). I coefficienti β sono dati (stimati prima).
 */
export function fitTypeWeights(players: readonly { crowd: readonly Choice[]; mega: readonly Choice[] }[], betaCrowd: readonly number[], betaMega: readonly number[], g0: TypeGrid, opts: { iters?: number; alpha?: number } = {}): number[] {
  const T = typeCount(g0), alpha = opts.alpha ?? 1, ll = players.filter((p) => p.crowd.length + p.mega.length > 0).map((p) => typeLogLiks(p.crowd, p.mega, betaCrowd, betaMega, g0));
  let w = new Array<number>(T).fill(1 / T);
  for (let it = 0; it < (opts.iters ?? 200); it++) {
    const acc = new Array<number>(T).fill(alpha);
    for (const l of ll) { const post = typePosterior({ ...g0, w }, l); for (let i = 0; i < T; i++) acc[i]! += post[i]!; }
    const z = acc.reduce((a, b) => a + b, 0); w = acc.map((v) => v / z);
  }
  return w;
}
