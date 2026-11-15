/**
 * Simulation Engine (Fase 5): valutazione Monte Carlo di candidati su «mondi» campionati, con
 *  - NUMERI CASUALI COMUNI: ogni candidato è valutato sugli stessi mondi (meno varianza nei confronti tra candidati);
 *  - ARRESTO ANTICIPATO: si smette quando il migliore batte il secondo con differenza appaiata significativa (soglia `earlyStopZ`);
 *  - LIMITE DI TEMPO: allo scadere si restituisce la migliore stima trovata finora (mai nessun ritardo oltre il budget);
 *  - parametri configurabili: numero di simulazioni, minimo, tempo massimo, soglia di arresto.
 * Il turno è un gioco a mosse SIMULTANEE: gli altri non rispondono alla mia scelta, i loro voti si campionano dal modello (Opponent Model) e si
 * calcola la mia migliore risposta; la scelta finale è mista (softmax / risposta quantale), non una ricerca ad albero sequenziale (Tak et al. 2014).
 */
export interface McOptions { samples: number; minSamples?: number; /** Tempo massimo in ms (assente = nessun limite). */ deadlineMs?: number; earlyStopZ?: number; batch?: number }
export interface McResult { means: number[]; n: number; stopped: "done" | "early" | "deadline" }

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function evaluateCandidates<W>(nCand: number, draw: () => W, util: (cand: number, world: W) => number, o: McOptions): McResult {
  const t0 = now(), batch = o.batch ?? 10, minS = Math.min(o.minSamples ?? 30, o.samples), z = o.earlyStopZ ?? 3, U: number[][] = [], sums = new Array<number>(nCand).fill(0);
  let stopped: McResult["stopped"] = "done";
  while (U.length < o.samples) {
    for (let b = 0; b < batch && U.length < o.samples; b++) { const w = draw(), row = new Array<number>(nCand); for (let c = 0; c < nCand; c++) { row[c] = util(c, w); sums[c]! += row[c]!; } U.push(row); }
    if (o.deadlineMs !== undefined && now() - t0 >= o.deadlineMs) { stopped = "deadline"; break; }
    if (U.length >= minS && nCand > 1 && U.length < o.samples) {
      let b1 = 0, b2 = -1; for (let c = 1; c < nCand; c++) if (sums[c]! > sums[b1]!) b1 = c;
      for (let c = 0; c < nCand; c++) if (c !== b1 && (b2 < 0 || sums[c]! > sums[b2]!)) b2 = c;
      const n = U.length; let m = 0, s2 = 0; for (const r of U) m += r[b1]! - r[b2]!; m /= n; for (const r of U) s2 += (r[b1]! - r[b2]! - m) ** 2;
      const se = Math.sqrt(s2 / Math.max(1, n - 1) / n); if (m > 0 && (se === 0 || m / se >= z)) { stopped = "early"; break; }
    }
  }
  return { means: sums.map((s) => s / U.length), n: U.length, stopped };
}

/** Estrae un indice 1-based da una distribuzione con un numero casuale `u` in [0,1) (stesso `u` = stesso quantile: serve ai numeri casuali comuni). */
export function sampleFrom(p: readonly number[], u: number): number { let k = 0; for (; k < p.length - 1; k++) { u -= p[k]!; if (u <= 0) break; } return k + 1; }

/** Scelta mista tra candidati: softmax dei valori con temperatura `tau` (risposta quantale); tau = 0 → il migliore. Restituisce l'indice. */
export function softmaxPick(vals: readonly number[], tau: number, rand: () => number): number {
  if (tau <= 0) return vals.reduce((b, v, i) => (v > vals[b]! ? i : b), 0);
  const m = Math.max(...vals), e = vals.map((v) => Math.exp((v - m) / tau)), z = e.reduce((a, b) => a + b, 0);
  let u = rand() * z; for (let i = 0; i < e.length; i++) { u -= e[i]!; if (u <= 0) return i; } return e.length - 1;
}

function erf(x: number): number { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); }
/** Funzione di ripartizione della normale standard. */
export const phi = (x: number): number => 0.5 * (1 + erf(x / Math.SQRT2));
