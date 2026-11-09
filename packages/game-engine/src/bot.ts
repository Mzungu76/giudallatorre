import type { Action, GameState, PlayerId } from "./types.ts";
import { luiAvailable, luiForbidden, megafonoOf, requiredPlayers } from "./engine.ts";

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
    case "MINI_PLAY":
    case "PLAY":
      if (!requiredPlayers(s).includes(playerId) || s.played[playerId] !== undefined) return null;
      return { type: "playCard", playerId, cardId: pick(s.hands[playerId]!) };
    case "SUSPECT":
      if (playerId !== mega) return null;
      { const av = luiAvailable(s, playerId); return { type: "placeLui", playerId, slot: av[Math.floor(rand() * av.length)]!, position: 1 + Math.floor(rand() * s.tower.length) }; }
    case "MINI_VOTE":
    case "VOTE": {
      if (s.votes[playerId] !== undefined) return null;
      // Il peggiore: la propria carta non si può votare
      const own = s.phase === "MINI_VOTE" && s.mini?.kind === "peggiore" ? s.tower.find((t) => t.ownerId === playerId)?.position : undefined;
      const banned = s.phase === "VOTE" ? luiForbidden(s, playerId) : null;   // «Il gregge»: il Megafono non vota la carta del suo Lui!
      const options = s.tower.map((t) => t.position).filter((p) => p !== own && p !== banned);
      return { type: "vote", playerId, position: pick(options) };
    }
    default: return null;
  }
}
