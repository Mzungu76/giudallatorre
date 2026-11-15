import { dot, softmax } from "./logit.ts";
import type { Choice } from "./logit.ts";

/**
 * Ragionamento per tipi (Albrecht & Stone 2018) con risposta quantale (McKelvey & Palfrey 1995): ogni giocatore ha un TIPO (λ, ε)
 *   P(vota k) = ε/n + (1 − ε) · softmax_k(λ · β·x)
 * λ = quanto è netto nel seguire gli indizi (0 = li ignora, 1 = come la popolazione), ε = quanto spesso vota a caso («mano che trema»).
 * Il tipo non si osserva: si tiene una DISTRIBUZIONE sui tipi (griglia), che parte dai pesi della popolazione e si aggiorna col teorema di Bayes
 * a ogni voto visto. Con pochi voti la distribuzione resta larga (nessuna «personalità» da due osservazioni); con più voti si stringe.
 * I pesi della popolazione si stimano dai dati con EM (`fitTypeWeights`), quindi riflettono le persone realmente osservate.
 */
export interface TypeGrid { lambda: number[]; eps: number[]; /** Pesi a priori, indice = li·eps.length + ei; sommano 1. */ w: number[] }

export function defaultTypeGrid(): TypeGrid {
  const lambda = [0.25, 0.5, 0.75, 1, 1.5, 2, 3], eps = [0, 0.15, 0.3, 0.45, 0.6, 0.75], n = lambda.length * eps.length;
  return { lambda, eps, w: new Array<number>(n).fill(1 / n) };
}
export const typeCount = (g: TypeGrid): number => g.lambda.length * g.eps.length;
export const typeOf = (g: TypeGrid, i: number): { lambda: number; eps: number } => ({ lambda: g.lambda[Math.floor(i / g.eps.length)]!, eps: g.eps[i % g.eps.length]! });

/** Probabilità di scelta di un tipo. */
export function mixProbs(x: readonly (readonly number[])[], beta: readonly number[], lambda: number, eps: number): number[] {
  const p = softmax(x.map((r) => lambda * dot(r, beta))), n = p.length;
  return p.map((v) => eps / n + (1 - eps) * v);
}

/** Log-verosimiglianza dei voti osservati di un giocatore sotto ciascun tipo (pesata dal decadimento). */
export function typeLogLiks(crowd: readonly Choice[], mega: readonly Choice[], betaCrowd: readonly number[], betaMega: readonly number[], g: TypeGrid): number[] {
  const out = new Array<number>(typeCount(g)).fill(0);
  for (let i = 0; i < out.length; i++) {
    const { lambda, eps } = typeOf(g, i); let s = 0;
    for (const c of crowd) s += c.w * Math.log(Math.max(mixProbs(c.x, betaCrowd, lambda, eps)[c.y]!, 1e-300));
    for (const c of mega) s += c.w * Math.log(Math.max(mixProbs(c.x, betaMega, lambda, eps)[c.y]!, 1e-300));
    out[i] = s;
  }
  return out;
}

/** Distribuzione a posteriori sui tipi: pesi a priori × verosimiglianza, normalizzata. */
export function typePosterior(g: TypeGrid, logLiks: readonly number[]): number[] {
  const lw = g.w.map((w, i) => Math.log(Math.max(w, 1e-300)) + logLiks[i]!), m = Math.max(...lw), e = lw.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}

/** Sintesi di una distribuzione sui tipi: λ ed ε attesi e quanto è ancora incerta (entropia normalizzata: 1 = nessuna informazione, 0 = certezza). */
export function describeTypes(g: TypeGrid, post: readonly number[]) {
  let lam = 0, eps = 0, h = 0; post.forEach((p, i) => { const t = typeOf(g, i); lam += p * t.lambda; eps += p * t.eps; if (p > 0) h -= p * Math.log(p); });
  return { lambda: lam, eps, uncertainty: h / Math.log(post.length) };
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
