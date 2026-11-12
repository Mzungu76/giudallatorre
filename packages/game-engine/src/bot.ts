import type { Action, GameState, PlayerId } from "./types.ts";
import { luiAvailable, luiForbidden, luiTokens, megafonoOf, requiredPlayers } from "./engine.ts";

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
      if (s.cnc) return { type: "placeMarks", playerId, marks: [{ slot: ["cade", "noncade", "nulli"][Math.floor(rand() * 3)]!, position: 1 + Math.floor(rand() * s.tower.length) }] };
      { const av = luiAvailable(s, playerId), slot = av[Math.floor(rand() * av.length)]!, n = s.tower.length, position = 1 + Math.floor(rand() * n);
        // Dirottamento! (PROPAGANDA): serve anche la carta che riceve il voto
        const dir = luiTokens(s).find((x) => x.slot === slot)?.effect === "dirottamento";
        return { type: "placeLui", playerId, slot, position, ...(dir ? { to: (position % n) + 1 } : {}) }; }
    case "MINI_RUN":
    case "VOTE": {
      if (s.votes[playerId] !== undefined) return null;
      const banned = s.phase === "VOTE" ? luiForbidden(s, playerId) : null;   // «Il gregge»: il Megafono non vota la carta del suo Lui!
      const options = s.tower.map((t) => t.position).filter((p) => p !== banned);
      return { type: "vote", playerId, position: pick(options) };
    }
    default: return null;
  }
}
