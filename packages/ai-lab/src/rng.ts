import { nextRandom } from "@gdt/game-engine";

/** Generatore deterministico dal seme (stesso PRNG del motore). */
export default function stream(seed: number): () => number {
  let r = seed | 0;
  return () => { const x = nextRandom(r); r = x.state; return x.value; };
}
