/** Statistica di base del laboratorio: medie, intervalli di confidenza al 95% e differenze appaiate. Nessuna dipendenza (gira anche in un Web Worker). */
export const Z95 = 1.959964;

export interface MeanCI { n: number; mean: number; sd: number; se: number; lo: number; hi: number; /** semi-ampiezza dell'intervallo */ half: number }

export function meanCI(xs: readonly number[]): MeanCI {
  const n = xs.length;
  if (n === 0) return { n: 0, mean: NaN, sd: NaN, se: NaN, lo: NaN, hi: NaN, half: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const se = sd / Math.sqrt(n), half = Z95 * se;
  return { n, mean, sd, se, lo: mean - half, hi: mean + half, half };
}

/** Intervallo di Wilson per una proporzione (successi su prove). Per vittorie "frazionarie" (parità divise) si usa `meanCI` sulle quote. */
export function wilson(successes: number, n: number): { p: number; lo: number; hi: number } {
  if (n === 0) return { p: NaN, lo: NaN, hi: NaN };
  const p = successes / n, z2 = Z95 * Z95, d = 1 + z2 / n, c = p + z2 / (2 * n), h = Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { p, lo: Math.max(0, (c - h) / d), hi: Math.min(1, (c + h) / d) };
}

/** Differenza appaiata A−B (una coppia per partita): media, IC 95% e se zero è fuori dall'intervallo. */
export function pairedDiff(a: readonly number[], b: readonly number[]): MeanCI & { significant: boolean } {
  const m = Math.min(a.length, b.length), d: number[] = [];
  for (let i = 0; i < m; i++) d.push(a[i]! - b[i]!);
  const ci = meanCI(d);
  return { ...ci, significant: ci.n > 1 && (ci.lo > 0 || ci.hi < 0) };
}

/** Dimensione del campione per distinguere una differenza `delta` con deviazione standard `sd` (potenza ~80%, α = 5%): n ≈ 2(z_α/2 + z_β)² sd² / δ² per differenze appaiate: n ≈ (z_α/2 + z_β)² sd² / δ². */
export function gamesNeeded(sd: number, delta: number): number { const z = Z95 + 0.841621; return Math.ceil(((z * sd) / delta) ** 2); }

/** Hash veloce e deterministico (cyrb53) per confrontare risultati ripetuti senza dipendenze di Node. */
export function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
