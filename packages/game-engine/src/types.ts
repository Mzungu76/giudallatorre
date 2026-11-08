export type PlayerId = string;
export type CardId = string;
export type Phase = "PROCLAIM" | "PLAY" | "SUSPECT" | "VOTE" | "RESULTS" | "MINI_PLAY" | "MINI_VOTE" | "MINI_RESULTS" | "GAME_OVER";
/** Mini-giochi di metà partita: Accusa, La storia d'amore, Il raccomandato. */
export type MiniKind = "accusa" | "amore" | "raccomandato";
export const MINI_KINDS: MiniKind[] = ["accusa", "amore", "raccomandato"];
/** Identificativo di un segnalino Lui!: "zero" (nessun voto dagli altri) oppure "k1", "k2", "k3" (almeno 1, 2, 3 voti dagli altri). */
export type LuiSlot = string;
/** Un segnalino: la scommessa è "almeno k voti dagli altri giocatori" (zero: nessun voto dagli altri) e vale `pts` punti. */
export interface LuiSpec { slot: LuiSlot; k: number; pts: number }

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
  /** Mini-gioco a metà partita: `false` (default) = nessuno, "random" = uno a caso tra i tre, oppure uno fisso. */
  miniGame?: false | "random" | MiniKind;
  /** Elenco delle accuse (testi) per il mini-gioco Accusa. */
  accuseDeck?: string[];
  /** Solo test: forza i segnalini Lui! della partita (id dal pool, es. ["k1","zero"]); di norma sono 2 a caso. */
  luiSlots?: string[];
}

export interface TowerSlot { position: number; cardId: CardId; ownerId: PlayerId | null }

export type PhraseChoice =
  | { mode: "card"; cardId: string; index: number; text: string; theme?: string }
  | { mode: "free"; text?: string };

export interface LuiToken { slot: LuiSlot; position: number }
/** Esito della scommessa del Lui! a fine turno. */
export interface LuiOutcome { slot: LuiSlot; position: number; k: number; pts: number; /** Voti degli altri giocatori sulla carta del Lui!. */ others: number; hit: boolean }

export interface TurnResult {
  turn: number;
  megafonoId: PlayerId;
  votes: Record<PlayerId, number>;
  counts: Record<number, number>;
  tie: boolean;
  /** Carta principale che cade (la prima di `fallenPositions`). */
  fallenPosition: number;
  fallenCardId: CardId;
  /** Tutte le carte che cadono: più di una solo in caso di pareggio (cadono tutte le carte a pari merito). */
  fallenPositions: number[];
  fallenCardIds: CardId[];
  /** Chi aveva giocato ciascuna carta caduta (stesso ordine; null = carta del mazzo), che prende il +2 della carta. */
  fallenOwnerIds: (PlayerId | null)[];
  /** Chi ha giocato la carta caduta (null = carta pescata dal mazzo). */
  fallenOwnerId: PlayerId | null;
  lui: LuiOutcome | null;
  points: Record<PlayerId, number>;
  /** Le voci del punteggio di ciascuno, per mostrare l'operazione in chiaro. */
  lines: Record<PlayerId, ScoreLine[]>;
  /** Voti degli altri sulla carta votata dal Megafono (1 punto ciascuno per il Megafono, cada o no). */
  collected: number;
  /** La carta votata dal Megafono. */
  megaVote: number;
  /** True se c'era un pareggio in testa e ha deciso il voto del Megafono (cade solo la sua carta). */
  tieBreak: boolean;
}

export interface ScoreLine { kind: "voto" | "carta" | "lui" | "lui-mancato" | "mini-voto" | "mini-carta" | "mini-perdita" | "mini-tetto"; pts: number; pos: number; n?: number }

/** Il mini-gioco in corso: la carta pescata (accusatore / protagonista della storia) e l'eventuale accusa. */
export interface Mini { kind: MiniKind; cardId: CardId | null; text: string | null }
export interface MiniResult {
  kind: MiniKind; cardId: CardId | null; text: string | null;
  votes: Record<PlayerId, number>; counts: Record<number, number>;
  /** Carte in testa (Accusa e Storia d'amore: restano e fanno punti; Raccomandato: sono quelle che cadono). */
  leaders: number[];
  fallenPositions: number[]; fallenCardIds: CardId[];
  /** Chi aveva giocato ciascuna carta (posizione → giocatore). */
  owners: Record<number, PlayerId>;
  points: Record<PlayerId, number>; lines: Record<PlayerId, ScoreLine[]>;
  /** Tetto ai punti guadagnati da un giocatore nel mini-gioco. */
  cap: number;
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
  /** Mini-gioco di metà partita (campi assenti nelle partite salvate prima: nessun mini-gioco). */
  miniGame?: false | "random" | MiniKind;
  accuseDeck?: string[];
  /** Primo intervallo (turno dopo cui si gioca). Le partite salvate prima avevano solo questo. */
  miniAt?: number;
  miniDone?: boolean;
  /** Turni dopo cui c'è un intervallo (1 fino a 5 giocatori, 2 da 6 a 8), intervalli già giocati e mini-giochi già usciti. */
  miniAts?: number[];
  minisDone?: number;
  miniKinds?: MiniKind[];
  mini?: Mini | null;
  miniResult?: MiniResult | null;
  /** Segnalini Lui! già spesi da ciascun giocatore (pubblico). */
  luiSpent?: Record<PlayerId, LuiSlot[]>;
  /** I 2 segnalini Lui! di questa partita (estratti a caso da un pool adatto al numero di giocatori, uguali per tutti). */
  luiSet?: LuiSpec[];
}

export type Action =
  | { type: "choosePhrase"; playerId: PlayerId; mode: "card"; index: number }
  | { type: "choosePhrase"; playerId: PlayerId; mode: "free"; text?: string }
  | { type: "playCard"; playerId: PlayerId; cardId: CardId }
  | { type: "placeLui"; playerId: PlayerId; slot: LuiSlot; position: number }
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
  | { type: "miniStarted"; kind: MiniKind }
  | { type: "miniResolved"; result: MiniResult }
  | { type: "goldenGoal"; leaders: PlayerId[] }
  | { type: "gameOver"; winners: PlayerId[] };

export type EngineErrorCode =
  | "INVALID_PLAYERS" | "INVALID_DECK" | "WRONG_PHASE" | "NOT_ALLOWED" | "UNKNOWN_PLAYER"
  | "ALREADY_DONE" | "CARD_NOT_IN_HAND" | "INVALID_POSITION" | "INVALID_CHOICE" | "GAME_OVER" | "DECK_EXHAUSTED";

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, message: string) { super(`${code}: ${message}`); this.name = "EngineError"; }
}
