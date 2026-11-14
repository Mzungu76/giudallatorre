import type { CardId, GameState, LuiSlot, LuiSpec, MiniKind, MiniResult, PhraseChoice, PlayerId, TurnResult } from "./types.ts";
import { luiForbidden, luiTokens, megafonoOf, requiredPlayers } from "./engine.ts";

/** Vista di un singolo giocatore: è l'UNICA cosa che il server invia al client. Nessun dato privato altrui. */
export interface PlayerView {
  viewerId: PlayerId;
  phase: GameState["phase"];
  turn: number; totalTurns: number;
  megafonoId: PlayerId;
  /** Il segnalino posato (dove; quale solo per il Megafono o dopo i risultati) e la carta che non puoi votare (Megafono: VOTI NULLI!). */
  marks: { position: number; slot: LuiSlot | null }[]; myForbidden: number | null;
  players: { id: PlayerId; name: string; score: number; megafonoTurns: number; handCount: number; hasPlayed: boolean; hasVoted: boolean }[];
  myHand: CardId[];
  /** Solo per il Megafono durante PROCLAIM. */
  proclaimCard: { id: string; phrases: string[]; theme?: string; themes?: string[] } | null;
  phrase: PhraseChoice | null;
  tower: { position: number; cardId: CardId; ownerId: PlayerId | null }[];
  /** I tre segnalini della partita (uguali per tutti). */
  luiTokens: LuiSpec[];
  myVote: number | null;
  /** Tutti i voti, solo da RESULTS in poi. */
  votes: Record<PlayerId, number> | null;
  lastResult: TurnResult | null;
  /** Mini-gioco di metà partita in corso (carta pescata e accusa, se c'è) e, a fine voto, il risultato. */
  mini: { kind: MiniKind; cardId: CardId | null; text: string | null; order: number[] } | null;
  miniResult: MiniResult | null;
  winners: PlayerId[] | null;
  goldenGoal: boolean;
  /** Giro corrente (1..rounds, oltre = spareggio), giri regolari e se il turno appena risolto chiude un giro. */
  round: number; rounds: number; roundEnd: boolean;
  drawPileCount: number; discardCount: number;
}

export function viewFor(s: GameState, viewer: PlayerId): PlayerView {
  const revealed = s.phase === "RESULTS" || s.phase === "MINI_RESULTS" || s.phase === "GAME_OVER", inMini = s.phase.startsWith("MINI");
  const isMega = viewer === megafonoOf(s);
  return {
    viewerId: viewer, phase: s.phase, turn: s.turnNumber, totalTurns: s.totalTurns,
    megafonoId: megafonoOf(s), marks: (s.marks ?? []).map((m) => ({ position: m.position, slot: isMega || revealed ? m.slot : null })),
    myForbidden: s.phase === "VOTE" ? luiForbidden(s, viewer) : null,
    players: s.playerIds.map((id) => ({ id, name: s.names[id]!, score: s.scores[id]!, megafonoTurns: s.megafonoTurns[id]!,
      handCount: s.hands[id]!.length, hasPlayed: s.played[id] !== undefined || (s.tower.length > 0 && requiredPlayers(s).includes(id)),
      hasVoted: s.votes[id] !== undefined })),
    myHand: s.hands[viewer]?.slice() ?? [],
    proclaimCard: s.phase === "PROCLAIM" && isMega && s.proclaim ? { id: s.proclaim.id, phrases: s.proclaim.phrases.slice(), ...(s.proclaim.theme ? { theme: s.proclaim.theme } : {}), ...(s.proclaim.themes ? { themes: s.proclaim.themes.slice() } : {}) } : null,
    phrase: s.phrase,
    tower: s.tower.map((t) => ({ position: t.position, cardId: t.cardId, ownerId: revealed ? t.ownerId : null })),
    luiTokens: luiTokens(s),
    myVote: s.votes[viewer] ?? null,
    votes: revealed ? { ...s.votes, ...(s.lastResult?.votes ?? {}) } : null,
    lastResult: revealed && !inMini ? s.lastResult : null,
    mini: inMini && s.mini ? { ...s.mini, order: s.mini.order.slice() } : null, miniResult: s.phase === "MINI_RESULTS" ? s.miniResult ?? null : null,
    winners: s.winners, goldenGoal: s.goldenGoal,
    round: Math.ceil(s.turnNumber / s.playerIds.length), rounds: s.rounds, roundEnd: s.phase === "RESULTS" && s.turnNumber % s.playerIds.length === 0,
    drawPileCount: s.drawPile.length, discardCount: s.discardPile.length,
  };
}
