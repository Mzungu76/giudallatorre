import type { GameState } from "./types.ts";

/** Conservazione delle carte: ogni carta del mazzo compare esattamente una volta. Restituisce i problemi trovati. */
export function checkInvariants(s: GameState, fullDeck: readonly string[]): string[] {
  const problems: string[] = [];
  const all: string[] = [...s.drawPile, ...s.discardPile, ...Object.values(s.hands).flat(), ...Object.values(s.played), ...s.tower.map((t) => t.cardId)];
  if (s.deckCard !== null && !s.tower.length) all.push(s.deckCard);
  if (all.length !== fullDeck.length) problems.push(`carte totali ${all.length} ≠ ${fullDeck.length}`);
  const seen = new Set<string>();
  for (const c of all) { if (seen.has(c)) problems.push(`carta duplicata ${c}`); seen.add(c); }
  for (const c of fullDeck) if (!seen.has(c)) problems.push(`carta mancante ${c}`);
  for (const p of s.playerIds) if (s.scores[p]! < 0) problems.push(`punteggio negativo ${p}`);
  return problems;
}
