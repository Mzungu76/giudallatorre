/**
 * Logit multinomiale («quale carta vota?») con prior gaussiano sui coefficienti: stima MAP con Newton e covarianza di Laplace.
 * È la base dell'Opponent Model bayesiano (Albrecht & Stone 2018: ricostruzione della politica / ragionamento per tipi) e della risposta quantale
 * (McKelvey & Palfrey 1995): la probabilità di scegliere un'opzione cresce con la sua utilità lineare x·β.
 * Funzioni pure, nessuna dipendenza: gira in un Worker e in un Web Worker.
 */

/** Una scelta osservata: le caratteristiche di ogni opzione (n×d), l'indice scelto e il peso (decadimento dei dati vecchi). */
export interface Choice { x: number[][]; y: number; w: number }

export function softmax(s: readonly number[]): number[] {
  const m = Math.max(...s), e = s.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}
export const dot = (a: readonly number[], b: readonly number[]): number => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!; return s; };

/** Probabilità di ogni opzione dato β. */
export const choiceProbs = (x: readonly (readonly number[])[], beta: readonly number[]): number[] => softmax(x.map((r) => dot(r, beta)));

export interface Fit { beta: number[]; /** Deviazione standard a posteriori (Laplace) di ogni coefficiente. */ sd: number[]; /** Peso totale dei dati usati. */ n: number; nll: number }

/** Funzione obiettivo (−log-verosimiglianza pesata + prior), gradiente e hessiana. */
function objective(beta: readonly number[], data: readonly Choice[], mu: readonly number[], sigma: readonly number[], wantH: boolean) {
  const d = beta.length; let f = 0; const g = new Array<number>(d).fill(0), H = wantH ? Array.from({ length: d }, () => new Array<number>(d).fill(0)) : null;
  for (const c of data) {
    const p = choiceProbs(c.x, beta);
    f -= c.w * Math.log(Math.max(p[c.y]!, 1e-300));
    const mean = new Array<number>(d).fill(0);
    for (let k = 0; k < p.length; k++) for (let i = 0; i < d; i++) mean[i]! += p[k]! * c.x[k]![i]!;
    for (let i = 0; i < d; i++) g[i]! -= c.w * (c.x[c.y]![i]! - mean[i]!);
    if (H) for (let k = 0; k < p.length; k++) for (let i = 0; i < d; i++) { const xi = c.x[k]![i]! - mean[i]!; if (xi === 0) continue; for (let j = 0; j < d; j++) H[i]![j]! += c.w * p[k]! * xi * (c.x[k]![j]! - mean[j]!); }
  }
  for (let i = 0; i < d; i++) { const r = (beta[i]! - mu[i]!) / sigma[i]!; f += 0.5 * r * r; g[i]! += r / sigma[i]!; if (H) H[i]![i]! += 1 / (sigma[i]! * sigma[i]!); }
  return { f, g, H };
}

/** Risolve A·x = b (A simmetrica definita positiva) con eliminazione di Gauss e pivot; restituisce anche l'inversa. */
export function solve(A: number[][], b: number[]): { x: number[]; inv: number[][] } {
  const d = b.length, M = A.map((r, i) => [...r, ...b.map((_, j) => (i === j ? 1 : 0)), b[i]!]);
  for (let c = 0; c < d; c++) {
    let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!]; const piv = M[c]![c]!;
    for (let k = c; k < 2 * d + 1; k++) M[c]![k]! /= piv;
    for (let r = 0; r < d; r++) if (r !== c) { const f = M[r]![c]!; if (f !== 0) for (let k = c; k < 2 * d + 1; k++) M[r]![k]! -= f * M[c]![k]!; }
  }
  return { x: M.map((r) => r[2 * d]!), inv: M.map((r) => r.slice(d, 2 * d)) };
}

/** Stima MAP di β con prior N(mu, sigma²). Convessa: Newton con dimezzamento del passo; poche iterazioni bastano. Senza dati restituisce il prior. */
export function fitMAP(data: readonly Choice[], mu: readonly number[], sigma: readonly number[], opts: { iters?: number; tol?: number } = {}): Fit {
  const d = mu.length; let beta = mu.slice(), cur = objective(beta, data, mu, sigma, true);
  for (let it = 0; it < (opts.iters ?? 25); it++) {
    const { x: step } = solve(cur.H!, cur.g); let t = 1, next = beta.map((b, i) => b - t * step[i]!), o = objective(next, data, mu, sigma, false);
    for (let h = 0; h < 12 && o.f > cur.f + 1e-12; h++) { t /= 2; next = beta.map((b, i) => b - t * step[i]!); o = objective(next, data, mu, sigma, false); }
    const move = Math.max(...next.map((v, i) => Math.abs(v - beta[i]!))); beta = next; cur = objective(beta, data, mu, sigma, true);
    if (move < (opts.tol ?? 1e-7)) break;
  }
  const { inv } = solve(cur.H!, new Array<number>(d).fill(0));
  return { beta, sd: inv.map((r, i) => Math.sqrt(Math.max(r[i]!, 0))), n: data.reduce((a, c) => a + c.w, 0), nll: cur.f };
}

/** Log-verosimiglianza media per scelta (nats) di β su dei dati: la misura di bontà delle previsioni. */
export function meanLogLik(data: readonly Choice[], beta: readonly number[]): number {
  let s = 0, w = 0; for (const c of data) { s += c.w * Math.log(Math.max(choiceProbs(c.x, beta)[c.y]!, 1e-300)); w += c.w; } return w ? s / w : NaN;
}
