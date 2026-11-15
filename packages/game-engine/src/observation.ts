import { viewFor } from "./views.ts";
import type { PlayerView } from "./views.ts";
import type { Action, CardId, GameState, PlayerId, TurnRecord } from "./types.ts";

/**
 * Tutto ciò che un giocatore seduto al tavolo può legittimamente sapere. È l'UNICO input dei motori strategici nuovi (Strategic AI Engine):
 * non contiene il `GameState`, quindi un motore non può leggere mani altrui, carte giocate coperte, voti segreti, proprietari delle carte sulla Torre
 * prima dello spoglio, il segnalino scelto da un altro Megafono, l'ordine dei mazzi né il seme del generatore casuale.
 * Si costruisce da `viewFor` (ciò che riceve il client) più due informazioni che il giocatore conosce comunque: la carta che ha giocato nel turno
 * e la storia pubblica dei turni già conclusi.
 */
export interface Observation extends PlayerView {
  /** La carta che ho giocato in questo turno e dove sta sulla Torre (la so: l'ho giocata io). Null prima di giocare. */
  myCard: { cardId: CardId; position: number | null } | null;
  /** Turni conclusi: voti, proprietari, carte cadute, segnalino. Tutto già mostrato a tutti allo spoglio. */
  history: TurnRecord[];
}

/** Costruisce l'osservazione di `me`. Funzione pura: non modifica lo stato. */
export function observe(s: GameState, me: PlayerId): Observation {
  const v = viewFor(s, me), slot = s.tower.find((t) => t.ownerId === me), played = s.played[me];
  const myCard = slot ? { cardId: slot.cardId, position: slot.position } : played !== undefined ? { cardId: played, position: null } : null;
  const history = (s.history ?? []).map((h) => structuredClone(h));
  return { ...v, myCard, history };
}

/** Le azioni legali di `me` calcolate SOLO dall'osservazione (nessun accesso allo stato). Vuoto se non deve agire. */
export function legalActions(o: Observation): Action[] {
  const me = o.viewerId, mega = o.megafonoId, out: Action[] = [];
  const mine = o.players.find((p) => p.id === me);
  switch (o.phase) {
    case "PROCLAIM":
      if (me === mega && o.proclaimCard) {
        for (let i = 0; i < o.proclaimCard.phrases.length; i++) out.push({ type: "choosePhrase", playerId: me, mode: "card", index: i });
        out.push({ type: "choosePhrase", playerId: me, mode: "free" });   // frase inventata: sempre ammessa dal motore
      }
      break;
    case "PLAY":
      if (mine && !mine.hasPlayed) for (const c of o.myHand) out.push({ type: "playCard", playerId: me, cardId: c });
      break;
    case "SUSPECT":
      if (me === mega) for (const slot of ["cade", "noncade", "nulli"]) for (const t of o.tower) out.push({ type: "placeMarks", playerId: me, marks: [{ slot, position: t.position }] });
      break;
    case "VOTE":
    case "MINI_RUN":
      if (o.myVote === null) for (const t of o.tower) if (t.position !== o.myForbidden) out.push({ type: "vote", playerId: me, position: t.position });
      break;
    default: break;
  }
  return out;
}

/** Vero se `a` è tra le azioni legali dell'osservazione (confronto strutturale). */
export const isLegal = (o: Observation, a: Action): boolean => { const k = JSON.stringify(a); return legalActions(o).some((x) => JSON.stringify(x) === k); };
