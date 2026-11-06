import type { Action, GameState, PlayerId } from "./types.ts";
import { megafonoOf, requiredPlayers } from "./engine.ts";

/** Azione legale scelta a caso per un giocatore (giocatori virtuali, test, giocatori inattivi). `rand` è esterno al motore. */
export function suggestAction(s: GameState, playerId: PlayerId, rand: () => number): Action | null {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const mega = megafonoOf(s);
  switch (s.phase) {
    case "PROCLAIM": {
      if (playerId !== mega) return null;
      const c = s.proclaim!;
      return rand() < 0.15 ? { type: "choosePhrase", playerId, mode: "free" } : { type: "choosePhrase", playerId, mode: "card", index: Math.floor(rand() * c.phrases.length) };
    }
    case "PLAY":
      if (!requiredPlayers(s).includes(playerId) || s.played[playerId] !== undefined) return null;
      return { type: "playCard", playerId, cardId: pick(s.hands[playerId]!) };
    case "SUSPECT":
      if (playerId !== mega) return null;
      return { type: "placeLui", playerId, kind: rand() < 0.5 ? "CADE" : "NON_CADE", position: 1 + Math.floor(rand() * s.tower.length) };
    case "VOTE":
      if (s.votes[playerId] !== undefined) return null;
      return { type: "vote", playerId, position: 1 + Math.floor(rand() * s.tower.length) };
    default: return null;
  }
}
