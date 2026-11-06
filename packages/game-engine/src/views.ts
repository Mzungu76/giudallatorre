import type { CardId, GameState, LuiKind, PhraseChoice, PlayerId, TurnResult } from "./types.ts";
import { megafonoOf, requiredPlayers } from "./engine.ts";

/** Vista di un singolo giocatore: è l'UNICA cosa che il server invia al client. Nessun dato privato altrui. */
export interface PlayerView {
  viewerId: PlayerId;
  phase: GameState["phase"];
  turn: number; totalTurns: number;
  megafonoId: PlayerId; megafonoSa: boolean;
  players: { id: PlayerId; name: string; score: number; megafonoTurns: number; handCount: number; hasPlayed: boolean; hasVoted: boolean }[];
  myHand: CardId[];
  /** Solo per il Megafono durante PROCLAIM. */
  proclaimCard: { id: string; phrases: string[] } | null;
  phrase: PhraseChoice | null;
  tower: { position: number; cardId: CardId; ownerId: PlayerId | null }[];
  luiPosition: number | null;
  /** Il tipo del segnalino è noto solo al Megafono fino ai risultati. */
  luiKind: LuiKind | null;
  myVote: number | null;
  /** Tutti i voti, solo da RESULTS in poi. */
  votes: Record<PlayerId, number> | null;
  lastResult: TurnResult | null;
  winners: PlayerId[] | null;
  goldenGoal: boolean;
  /** Giro corrente (1..rounds, oltre = spareggio), giri regolari e se il turno appena risolto chiude un giro. */
  round: number; rounds: number; roundEnd: boolean;
  drawPileCount: number; discardCount: number;
}

export function viewFor(s: GameState, viewer: PlayerId): PlayerView {
  const revealed = s.phase === "RESULTS" || s.phase === "GAME_OVER";
  const isMega = viewer === megafonoOf(s);
  return {
    viewerId: viewer, phase: s.phase, turn: s.turnNumber, totalTurns: s.totalTurns,
    megafonoId: megafonoOf(s), megafonoSa: s.megafonoSa,
    players: s.playerIds.map((id) => ({ id, name: s.names[id]!, score: s.scores[id]!, megafonoTurns: s.megafonoTurns[id]!,
      handCount: s.hands[id]!.length, hasPlayed: s.played[id] !== undefined || (s.tower.length > 0 && requiredPlayers(s).includes(id)),
      hasVoted: s.votes[id] !== undefined })),
    myHand: s.hands[viewer]?.slice() ?? [],
    proclaimCard: s.phase === "PROCLAIM" && isMega && s.proclaim ? { id: s.proclaim.id, phrases: s.proclaim.phrases.slice() } : null,
    phrase: s.phrase,
    tower: s.tower.map((t) => ({ position: t.position, cardId: t.cardId, ownerId: revealed ? t.ownerId : null })),
    luiPosition: s.lui ? s.lui.position : null,
    luiKind: s.lui && (isMega || revealed) ? s.lui.kind : null,
    myVote: s.votes[viewer] ?? null,
    votes: revealed ? { ...s.votes, ...(s.lastResult?.votes ?? {}) } : null,
    lastResult: revealed ? s.lastResult : null,
    winners: s.winners, goldenGoal: s.goldenGoal,
    round: Math.ceil(s.turnNumber / s.playerIds.length), rounds: s.rounds, roundEnd: s.phase === "RESULTS" && s.turnNumber % s.playerIds.length === 0,
    drawPileCount: s.drawPile.length, discardCount: s.discardPile.length,
  };
}
