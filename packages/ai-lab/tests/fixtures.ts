import type { LabContent } from "../src/index.ts";

/** Contenuti piccoli per i test (senza etichette: i bot ripiegano sulla storia delle carte). */
export const content: LabContent = {
  deck: Array.from({ length: 125 }, (_, i) => `c${String(i + 1).padStart(3, "0")}`),
  accuseDeck: ["Mi ha rubato il panino!"],
  phraseDeck: (seed) => [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `m${seed}-${i}`, phrases: ["a", "b", "c", "d", "e"].map((x) => `m${i}-${x}`) })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, phrases: [`s${i}-unica`] })),
  ],
};
