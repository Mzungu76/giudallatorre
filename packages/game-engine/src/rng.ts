/** PRNG deterministico (mulberry32) con stato intero serializzabile: nessun Math.random nel motore. */
export function nextRandom(state: number): { value: number; state: number } {
  let a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}
/** Fisher–Yates; aggiorna lo stato rng passato per riferimento (oggetto con campo rng). */
export function shuffle<T>(items: readonly T[], holder: { rng: number }): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRandom(holder.rng); holder.rng = r.state;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
export function randomInt(max: number, holder: { rng: number }): number {
  const r = nextRandom(holder.rng); holder.rng = r.state; return Math.floor(r.value * max);
}
