import { megafonoOf } from "../src/index.ts";
import type { GameState, PlayerId } from "../src/index.ts";

/**
 * Lo stato com'è visto da `me`: tutto ciò che un giocatore seduto al tavolo NON può sapere viene alterato (stessa logica di fairplay.test.ts).
 * Se un'osservazione o una decisione dipendesse da una di queste informazioni, cambierebbe e il test fallirebbe.
 */
export function hideFrom(s: GameState, me: PlayerId): GameState {
  const t = structuredClone(s), others = t.playerIds.filter((p) => p !== me), mega = megafonoOf(t);
  for (const p of others) t.hands[p] = t.hands[p]!.map((_, k) => `carta-finta-${p}-${k}`);                  // mani degli altri
  for (const p of others) if (t.played[p] !== undefined) t.played[p] = "carta-finta-giocata";               // carte giocate coperte
  for (const p of others) if (t.votes[p] !== undefined && (t.phase.endsWith("VOTE") || t.phase === "MINI_RUN")) t.votes[p] = (t.votes[p]! % Math.max(1, t.tower.length)) + 1; // voti degli altri, segreti
  let k = 0;                                                                                                // proprietari delle carte sulla Torre (tranne la propria), finché sono nascosti
  const hidden = !(t.phase === "RESULTS" || t.phase === "MINI_RESULTS" || t.phase === "GAME_OVER");
  if (hidden) for (const sl of t.tower) if (sl.ownerId !== null && sl.ownerId !== me) { sl.ownerId = others[(++k) % others.length]!; }
  if (t.marks && me !== mega && hidden) { const order = ["cade", "noncade", "nulli"]; t.marks = t.marks.map((m) => ({ ...m, slot: order[(order.indexOf(m.slot) + 1) % 3]! })); }   // quali segnalini sono
  if (me !== mega) t.proclaim = null;                                                                      // la carta frase è solo del Megafono
  t.drawPile = t.drawPile.slice().reverse(); t.discardPile = t.discardPile.slice().reverse();              // ordine dei mazzi
  t.phraseDraw = t.phraseDraw.slice().reverse(); t.rng = (t.rng + 7) | 0;
  return t;
}
