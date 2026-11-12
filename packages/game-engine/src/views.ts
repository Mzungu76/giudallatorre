import type { CardId, GameState, LuiSlot, LuiSpec, MiniKind, MiniResult, ObjectiveSpec, PhraseChoice, PlayerId, TurnResult } from "./types.ts";
import { luiAvailable, luiForbidden, luiTokens, megafonoOf, requiredPlayers } from "./engine.ts";

/** Vista di un singolo giocatore: è l'UNICA cosa che il server invia al client. Nessun dato privato altrui. */
export interface PlayerView {
  viewerId: PlayerId;
  phase: GameState["phase"];
  turn: number; totalTurns: number;
  megafonoId: PlayerId; megafonoSa: boolean;
  /** Variante «Il gregge»: il segnalino 0 è una trappola per chi vota la sua carta. */
  gregge: boolean;
  /** Gioco base «Cade / Non cade»: i due segnalini posati (dove; quale solo per il Megafono o dopo i risultati) e la carta che non puoi votare (Megafono: VOTI NULLI!). */
  cnc: boolean; marks: { position: number; slot: LuiSlot | null }[]; myForbidden: number | null;
  /** Variante PROPAGANDA e, dentro, obiettivi contrapposti. */
  propaganda: boolean; objectives: boolean;
  /** Obiettivo del turno (da SUSPECT a VOTE): il Megafono vede anche il personaggio (`position`), gli altri solo la condizione (`position` null). */
  objective: (ObjectiveSpec & { position: number | null }) | null;
  /** Dirottamento!: carta che riceve il voto spostato (solo il Megafono, fino ai risultati). */
  luiTo: number | null;
  players: { id: PlayerId; name: string; score: number; megafonoTurns: number; handCount: number; hasPlayed: boolean; hasVoted: boolean }[];
  myHand: CardId[];
  /** Intervalli iniziati: a ognuno la mano di tutti è stata sostituita per intero (l'app lo mostra con un'animazione quando si apre la scelta della carta). */
  handRenewals: number;
  /** Posizione sulla Torre della carta che hai giocato (la sai solo tu). Serve a non farti votare la tua carta nel mini-gioco «Il peggiore». */
  myPosition: number | null;
  /** Solo per il Megafono durante PROCLAIM. */
  proclaimCard: { id: string; phrases: string[]; theme?: string; themes?: string[] } | null;
  phrase: PhraseChoice | null;
  tower: { position: number; cardId: CardId; ownerId: PlayerId | null }[];
  luiPosition: number | null;
  /** Quale segnalino è stato posato: noto solo al Megafono fino ai risultati. */
  luiSlot: LuiSlot | null;
  /** I 2 segnalini di questa partita (uguali per tutti) e quali ti restano: i segnalini degli altri non si vedono. */
  luiTokens: LuiSpec[];
  myLuiLeft: LuiSlot[];
  myVote: number | null;
  /** Tutti i voti, solo da RESULTS in poi. */
  votes: Record<PlayerId, number> | null;
  lastResult: TurnResult | null;
  /** Mini-gioco di metà partita in corso (carta pescata e accusa, se c'è) e, a fine voto, il risultato. */
  mini: { kind: MiniKind; cardId: CardId | null; text: string | null } | null;
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
    megafonoId: megafonoOf(s), megafonoSa: s.megafonoSa, gregge: !!s.gregge, cnc: !!s.cnc, marks: (s.marks ?? []).map((m) => ({ position: m.position, slot: isMega || revealed ? m.slot : null })),
    myForbidden: s.phase === "VOTE" ? luiForbidden(s, viewer) : null, propaganda: !!s.propaganda, objectives: !!s.objectives,
    objective: s.objective && (s.phase === "SUSPECT" || s.phase === "VOTE") ? { kind: s.objective.kind, k: s.objective.k, pts: s.objective.pts, position: isMega ? s.objective.position : null } : null,
    luiTo: s.lui?.to && (isMega || revealed) ? s.lui.to : null,
    players: s.playerIds.map((id) => ({ id, name: s.names[id]!, score: s.scores[id]!, megafonoTurns: s.megafonoTurns[id]!,
      handCount: s.hands[id]!.length, hasPlayed: s.played[id] !== undefined || (s.tower.length > 0 && requiredPlayers(s).includes(id)),
      hasVoted: s.votes[id] !== undefined })),
    myHand: s.hands[viewer]?.slice() ?? [],
    handRenewals: s.miniKinds?.length ?? (s.miniDone ? 1 : 0),
    myPosition: s.tower.find((t) => t.ownerId === viewer)?.position ?? null,
    proclaimCard: s.phase === "PROCLAIM" && isMega && s.proclaim ? { id: s.proclaim.id, phrases: s.proclaim.phrases.slice(), ...(s.proclaim.theme ? { theme: s.proclaim.theme } : {}), ...(s.proclaim.themes ? { themes: s.proclaim.themes.slice() } : {}) } : null,
    phrase: s.phrase,
    tower: s.tower.map((t) => ({ position: t.position, cardId: t.cardId, ownerId: revealed ? t.ownerId : null })),
    luiPosition: s.lui ? s.lui.position : null,
    luiSlot: s.lui && (isMega || revealed) ? s.lui.slot : null,
    luiTokens: luiTokens(s), myLuiLeft: luiAvailable(s, viewer),
    myVote: s.votes[viewer] ?? null,
    votes: revealed ? { ...s.votes, ...(s.lastResult?.votes ?? {}) } : null,
    lastResult: revealed && !inMini ? s.lastResult : null,
    mini: inMini && s.mini ? { ...s.mini } : null, miniResult: s.phase === "MINI_RESULTS" ? s.miniResult ?? null : null,
    winners: s.winners, goldenGoal: s.goldenGoal,
    round: Math.ceil(s.turnNumber / s.playerIds.length), rounds: s.rounds, roundEnd: s.phase === "RESULTS" && s.turnNumber % s.playerIds.length === 0,
    drawPileCount: s.drawPile.length, discardCount: s.discardPile.length,
  };
}
