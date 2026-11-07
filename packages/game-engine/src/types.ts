export type PlayerId = string;
export type CardId = string;
export type Phase = "PROCLAIM" | "PLAY" | "SUSPECT" | "VOTE" | "RESULTS" | "GAME_OVER";
export type LuiKind = "CADE" | "NON_CADE";

/** Carta "Su sulla Torre": 1 frase = carta singola (obbligatoria), più frasi = il Megafono ne sceglie una. */
export interface PhraseCard { id: string; phrases: string[]; /** Contesto della carta (es. “In palestra”), mostrato come titoletto. */ theme?: string; /** Contesto di ciascuna frase (stesso ordine di `phrases`). */ themes?: string[] }

export interface GameConfig {
  players: { id: PlayerId; name: string }[];
  seed: number;
  /** Variante "Il Megafono sa": il Megafono gioca una carta dalla propria mano invece di pescarla dal mazzo. */
  megafonoSa?: boolean;
  /** Mescola a caso le frasi di tutte le carte (ogni frase porta il proprio contesto) e le ridistribuisce in gruppi da 5. */
  mixPhrases?: boolean;
  deck: CardId[];
  phraseDeck: PhraseCard[];
  handSize?: number;
  /** Indice del primo Megafono; se omesso è scelto a caso (seed). */
  firstMegafonoIndex?: number;
}

export interface TowerSlot { position: number; cardId: CardId; ownerId: PlayerId | null }

export type PhraseChoice =
  | { mode: "card"; cardId: string; index: number; text: string; theme?: string }
  | { mode: "free"; text?: string };

export interface LuiToken { kind: LuiKind; position: number }

export interface TurnResult {
  turn: number;
  megafonoId: PlayerId;
  votes: Record<PlayerId, number>;
  counts: Record<number, number>;
  tie: boolean;
  /** Carta principale che cade (la prima di `fallenPositions`). */
  fallenPosition: number;
  fallenCardId: CardId;
  /** Tutte le carte che cadono: più di una solo in caso di pareggio (la carta votata dal Megafono resta su). */
  fallenPositions: number[];
  fallenCardIds: CardId[];
  /** Chi aveva giocato ciascuna carta caduta (stesso ordine; null = carta del mazzo), che prende il +2 della carta. */
  fallenOwnerIds: (PlayerId | null)[];
  /** Chi ha giocato la carta caduta (null = carta pescata dal mazzo). */
  fallenOwnerId: PlayerId | null;
  lui: LuiToken | null;
  points: Record<PlayerId, number>;
  reasons: Record<PlayerId, string[]>;
  /** True se la regola del gregge ha tolto i +2 ai votanti della carta caduta (votata anche dal Megafono). */
  herd: boolean;
}

export interface GameState {
  version: 1;
  playerIds: PlayerId[];
  names: Record<PlayerId, string>;
  megafonoSa: boolean;
  mixPhrases: boolean;
  handSize: number;
  rounds: number;
  totalTurns: number;
  turnNumber: number;
  megafonoIndex: number;
  phase: Phase;
  hands: Record<PlayerId, CardId[]>;
  drawPile: CardId[];
  discardPile: CardId[];
  phraseDraw: PhraseCard[];
  phraseDiscard: PhraseCard[];
  rng: number;
  /** Carta frase pescata, visibile solo al Megafono durante PROCLAIM. */
  proclaim: PhraseCard | null;
  phrase: PhraseChoice | null;
  /** Carte giocate coperte in attesa della rivelazione (giocatore -> carta). */
  played: Record<PlayerId, CardId>;
  /** Carta pescata dal mazzo per la Torre (modalità base). */
  deckCard: CardId | null;
  tower: TowerSlot[];
  lui: LuiToken | null;
  votes: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  megafonoTurns: Record<PlayerId, number>;
  lastResult: TurnResult | null;
  winners: PlayerId[] | null;
  /** Spareggio a oltranza: si gioca un turno alla volta finché un giocatore ha più punti di tutti gli altri. */
  goldenGoal: boolean;
  goldenTurns: number;
}

export type Action =
  | { type: "choosePhrase"; playerId: PlayerId; mode: "card"; index: number }
  | { type: "choosePhrase"; playerId: PlayerId; mode: "free"; text?: string }
  | { type: "playCard"; playerId: PlayerId; cardId: CardId }
  | { type: "placeLui"; playerId: PlayerId; kind: LuiKind; position: number }
  | { type: "vote"; playerId: PlayerId; position: number}
  | { type: "advance"; playerId?: PlayerId };

export type GameEvent =
  | { type: "turnStarted"; turn: number; megafonoId: PlayerId }
  | { type: "phraseChosen"; mode: "card" | "free"; text?: string }
  | { type: "cardPlayed"; playerId: PlayerId }
  | { type: "towerRevealed"; positions: number }
  | { type: "luiPlaced"; position: number }
  | { type: "voteCast"; playerId: PlayerId }
  | { type: "resolved"; result: TurnResult }
  | { type: "turnEnded"; turn: number }
  | { type: "goldenGoal"; leaders: PlayerId[] }
  | { type: "gameOver"; winners: PlayerId[] };

export type EngineErrorCode =
  | "INVALID_PLAYERS" | "INVALID_DECK" | "WRONG_PHASE" | "NOT_ALLOWED" | "UNKNOWN_PLAYER"
  | "ALREADY_DONE" | "CARD_NOT_IN_HAND" | "INVALID_POSITION" | "INVALID_CHOICE" | "GAME_OVER" | "DECK_EXHAUSTED";

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, message: string) { super(`${code}: ${message}`); this.name = "EngineError"; }
}
