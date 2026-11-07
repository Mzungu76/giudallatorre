import { applyAction, createGame, megafonoOf, requiredPlayers } from "../src/index.ts";
import type { Action, GameConfig, GameState, PhraseCard } from "../src/index.ts";

export const makeDeck = (n: number) => Array.from({ length: n }, (_, i) => `c${String(i + 1).padStart(3, "0")}`);
export const PHRASES: PhraseCard[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, phrases: ["a", "b", "c", "d", "e"].map((x) => `m${i}-${x}`) })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, phrases: [`s${i}-unica`] })),
];
export const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Giocatore ${i + 1}` }));
export function cfg(n: number, extra: Partial<GameConfig> = {}): GameConfig {
  return { players: names(n), seed: 42, deck: makeDeck(125), phraseDeck: PHRASES, firstMegafonoIndex: 0, luiSlots: ["k1", "k2", "k3", "zero"], ...extra };
}
export const start = (n: number, extra: Partial<GameConfig> = {}) => createGame(cfg(n, extra)).state;
export const act = (s: GameState, a: Action) => applyAction(s, a).state;

/** Porta la partita fino alla fase SUSPECT: il Megafono usa la prima frase, tutti giocano la prima carta della mano. */
export function toSuspect(s: GameState): GameState {
  let g = act(s, { type: "choosePhrase", playerId: megafonoOf(s), mode: "card", index: 0 });
  for (const p of requiredPlayers(g)) g = act(g, { type: "playCard", playerId: p, cardId: g.hands[p]![0]! });
  return g;
}
/** Come toSuspect ma posa anche il Lui! e arriva alla fase VOTE. */
export function toVote(s: GameState, lui: { slot: "k1" | "k3" | "zero"; position: number } = { slot: "k1", position: 1 }): GameState {
  const g = toSuspect(s);
  return act(g, { type: "placeLui", playerId: megafonoOf(g), ...lui });
}
/** Fa votare ciascun giocatore secondo la mappa id->posizione e restituisce lo stato (RESULTS se tutti hanno votato). */
export function castVotes(s: GameState, votes: Record<string, number>): GameState {
  let g = s;
  for (const p of s.playerIds) g = act(g, { type: "vote", playerId: p, position: votes[p]! });
  return g;
}

/** Posizione sulla Torre della carta giocata da `owner` (null = carta del mazzo). */
export const posOf = (s: GameState, owner: string | null) => s.tower.find((t) => t.ownerId === owner)!.position;
