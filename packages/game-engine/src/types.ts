export type PlayerId = string;
export type CardId = string;
export type Phase = "PROCLAIM" | "PLAY" | "SUSPECT" | "VOTE" | "RESULTS" | "MINI_RUN" | "MINI_RESULTS" | "GAME_OVER";
/** Mini-giochi (intervalli): Accusa, La storia d'amore, Il peggiore. */
export type MiniKind = "accusa" | "amore" | "peggiore";
export const MINI_KINDS: MiniKind[] = ["accusa", "amore", "peggiore"];
/** Identificativo di un segnalino: "cade", "noncade" o "nulli". */
export type LuiSlot = string;
/** Effetto di un segnalino del gioco base «Cade / Non cade». */
export type LuiEffect = "cade" | "noncade" | "nulli";
/** Un segnalino del Megafono: CADE (+4), NON CADE (+2) o VOTI NULLI! (annulla i voti sulla sua carta). */
export interface LuiSpec { slot: LuiSlot; k: number; pts: number; effect?: LuiEffect }

/** Carta "Su sulla Torre": 1 frase = carta singola (obbligatoria), più frasi = il Megafono ne sceglie una. */
export interface PhraseCard { id: string; phrases: string[]; /** Contesto della carta (es. “In palestra”), mostrato come titoletto. */ theme?: string; /** Contesto di ciascuna frase (stesso ordine di `phrases`). */ themes?: string[] }

export interface GameConfig {
  players: { id: PlayerId; name: string }[];
  seed: number;
  /** Giocatori virtuali: non ricevono il premio della serata (se ci sono giocatori veri). */
  botIds?: PlayerId[];
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
}

export interface TowerSlot { position: number; cardId: CardId; ownerId: PlayerId | null }

export type PhraseChoice =
  | { mode: "card"; cardId: string; index: number; text: string; theme?: string }
  | { mode: "free"; text?: string };

/** Un segnalino posato dal Megafono su una carta della Torre. */
export interface LuiToken { slot: LuiSlot; position: number }
/** Esito del segnalino: `hit`: CADE caduta, NON CADE rimasta su, VOTI NULLI! almeno un voto annullato.
 *  `voters`: chi della Folla l'ha votata con voto valido (e prende il premio se riesce); `caught`: voti annullati da VOTI NULLI!. */
export interface MarkOutcome { slot: LuiSlot; effect: LuiEffect; position: number; hit: boolean; voters: PlayerId[]; caught?: PlayerId[] }

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
  points: Record<PlayerId, number>;
  /** Le voci del punteggio di ciascuno, per mostrare l'operazione in chiaro. */
  lines: Record<PlayerId, ScoreLine[]>;
  /** Voti degli altri sulla carta votata dal Megafono (1 punto ciascuno per il Megafono, cada o no). */
  collected: number;
  /** La carta votata dal Megafono. */
  megaVote: number;
  /** True se c'era un pareggio in testa e ha deciso il voto del Megafono (cade solo la sua carta). */
  tieBreak: boolean;
  /** Il segnalino posato e com'è andata. */
  marks: MarkOutcome[];
}

export interface ScoreLine { kind: "voto" | "carta" | "lui" | "lui-mancato" | "lui-folla" | "mini-giusto" | "mini-veloce"; pts: number; pos: number; n?: number }

/** Il mini-gioco in corso: la carta pescata (accusatore / protagonista della storia) e l'eventuale accusa. */
export interface Mini {
  kind: MiniKind; cardId: CardId | null; text: string | null;
  /** Intervallo a tempo: le posizioni (1..6) delle carte nell'ordine in cui escono dal separé, tre giri completi (18 uscite). */
  order: number[];
}
export interface MiniResult {
  kind: MiniKind; cardId: CardId | null; text: string | null;
  /** Chi ha votato (solo chi ha premuto in tempo) e cosa. */
  votes: Record<PlayerId, number>; counts: Record<number, number>;
  /** Carte in testa (a parità tutte): nell'Accusa e nel Peggiore cadono, nella Storia d'amore vincono e restano. Vuoto se nessuno ha votato. */
  leaders: number[];
  fallenPositions: number[]; fallenCardIds: CardId[];
  /** Il più veloce tra chi ha votato una carta in testa (+4), se c'è. */
  fastest: PlayerId | null;
  points: Record<PlayerId, number>; lines: Record<PlayerId, ScoreLine[]>;
}

/** Premi della serata (uno solo a partita, assegnato a fine partita). Titolo e battute vivono in public/testi.json (premio.<id>.*). */
export type AwardId = "pollo" | "bugiardo" | "ingenuo" | "segugio" | "bersaglio" | "ruffiano" | "lupo" | "narciso" | "veggente" | "bocciato" | "tabellone";
export interface Award {
  id: AwardId; winnerId: PlayerId;
  /** Il numero che motiva il premio (per esempio 7 voti su 8 turni); nel premio di consolazione `n` sono i punti e `of` è 0. */
  n: number; of: number;
  /** True se nessun premio ha raggiunto la soglia e si assegna quello di consolazione. */
  consolation?: boolean;
}

/** Cosa è successo in un turno, in forma compatta: il motore ne tiene uno per turno per calcolare il premio della serata. */
export interface TurnRecord {
  turn: number; megafonoId: PlayerId;
  votes: Record<PlayerId, number>;
  /** Chi aveva giocato la carta in ciascuna posizione (null = carta del mazzo). */
  owners: Record<number, PlayerId | null>;
  fallen: number[];
  megaVote: number;
  /** Segnalino del Megafono (gioco base): dove, che tipo e se ha avuto ragione. */
  mark: { position: number; effect: LuiEffect; hit: boolean } | null;
}

export interface GameState {
  version: 1;
  playerIds: PlayerId[];
  names: Record<PlayerId, string>;
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
  tower: TowerSlot[];
  votes: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  megafonoTurns: Record<PlayerId, number>;
  lastResult: TurnResult | null;
  winners: PlayerId[] | null;
  /** Registro dei turni giocati (campo assente nelle partite salvate prima del premio della serata). */
  history?: TurnRecord[];
  /** Giocatori virtuali, esclusi dal premio della serata. */
  botIds?: PlayerId[];
  /** Premio della serata, assegnato quando la partita finisce. */
  award?: Award | null;
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
  /** Intervallo a tempo: chi ha votato, nell'ordine in cui i voti sono arrivati (il primo tra i vincitori prende +4). */
  voteOrder?: PlayerId[];
  miniResult?: MiniResult | null;
  /** Il segnalino posato nel turno. */
  marks?: LuiToken[] | null;
}

export type Action =
  | { type: "choosePhrase"; playerId: PlayerId; mode: "card"; index: number }
  | { type: "choosePhrase"; playerId: PlayerId; mode: "free"; text?: string }
  | { type: "playCard"; playerId: PlayerId; cardId: CardId }
  | { type: "placeMarks"; playerId: PlayerId; marks: { slot: LuiSlot; position: number }[] }
  | { type: "vote"; playerId: PlayerId; position: number}
  | { type: "advance"; playerId?: PlayerId }
  /** Solo il server: scade il tempo dell'intervallo, si contano i voti arrivati. */
  | { type: "endRun" };

export type GameEvent =
  | { type: "turnStarted"; turn: number; megafonoId: PlayerId }
  | { type: "phraseChosen"; mode: "card" | "free"; text?: string }
  | { type: "cardPlayed"; playerId: PlayerId }
  | { type: "towerRevealed"; positions: number }
  | { type: "marksPlaced"; positions: number[] }
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
