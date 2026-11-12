export type PlayerId = string;
export type CardId = string;
export type Phase = "PROCLAIM" | "PLAY" | "SUSPECT" | "VOTE" | "RESULTS" | "MINI_RUN" | "MINI_RESULTS" | "GAME_OVER";
/** Mini-giochi (intervalli): Accusa, La storia d'amore, Il peggiore. */
export type MiniKind = "accusa" | "amore" | "peggiore";
export const MINI_KINDS: MiniKind[] = ["accusa", "amore", "peggiore"];
/** Identificativo di un segnalino Lui!: "zero" (nessun voto dagli altri) oppure "k1", "k2", "k3" (almeno 1, 2, 3 voti dagli altri). */
export type LuiSlot = string;
/** Un segnalino: la scommessa è "almeno k voti dagli altri giocatori" (zero: nessun voto dagli altri) e vale `pts` punti. */
/** Variante PROPAGANDA: effetto del segnalino (3 positivi, 3 negativi). */
export type LuiEffect = "propaganda" | "spareggio" | "influenza" | "imbroglio" | "dirottamento" | "censura" | "cade" | "noncade" | "nulli";
export interface LuiSpec { slot: LuiSlot; k: number; pts: number; /** Variante PROPAGANDA: cosa fa il segnalino (k = voti aggiunti per Propaganda!) e se è positivo. */ effect?: LuiEffect; positive?: boolean; /** Variante «Il gregge»: lo 0 è l'Imbroglio!: i voti sulla sua carta sono annullati (non contano per la maggioranza né per i punti); se ne annulla almeno uno (k = 1), il Megafono prende `pts`. */ trap?: boolean; /** Variante «Il gregge», soglia: i punti vanno al Megafono (che non può votarla) e a chi vota la carta. */ herd?: boolean }

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
  /** Variante «Il gregge» (in prova): lo 0 diventa l'Imbroglio! (annulla i voti sulla sua carta), la soglia premia anche chi vota la carta. */
  gregge?: boolean;
  /** Gioco base «Cade / Non cade»: il Megafono gioca una carta dalla mano («Il Megafono sa» sempre attivo) e a ogni turno posa 1 segnalino coperto,
   *  scelto tra CADE (+4), NON CADE (+2) e VOTI NULLI! (annulla i voti); i premi vanno anche a chi vota la carta. Senza: regole precedenti. */
  cnc?: boolean;
  /** Variante PROPAGANDA (in prova): 2 segnalini di manipolazione del voto (1 positivo e 1 negativo, estratti a caso). */
  propaganda?: boolean;
  /** Dentro PROPAGANDA: obiettivi contrapposti (un obiettivo segreto per il Megafono a ogni turno). */
  objectives?: boolean;
  /** Solo test: forza i segnalini Lui! della partita (id dal pool, es. ["k1","zero"]); di norma sono 2 a caso. */
  luiSlots?: string[];
}

export interface TowerSlot { position: number; cardId: CardId; ownerId: PlayerId | null }

export type PhraseChoice =
  | { mode: "card"; cardId: string; index: number; text: string; theme?: string }
  | { mode: "free"; text?: string };

export interface LuiToken { slot: LuiSlot; position: number; /** Dirottamento!: carta che riceve il voto spostato. */ to?: number }
/** Gioco base «Cade / Non cade»: esito di ciascuno dei due segnalini. `hit`: CADE caduta, NON CADE rimasta su, VOTI NULLI! almeno un voto annullato.
 *  `voters`: chi della Folla l'ha votata con voto valido (e prende il premio se riesce); `caught`: voti annullati da VOTI NULLI!. */
export interface MarkOutcome { slot: LuiSlot; effect: LuiEffect; position: number; hit: boolean; voters: PlayerId[]; caught?: PlayerId[] }
/** PROPAGANDA, obiettivi contrapposti: condizione sui voti ufficiali (dopo i segnalini) di un personaggio. */
export type ObjectiveKind = "almeno" | "nessuno" | "esattamente";
export interface ObjectiveSpec { kind: ObjectiveKind; k: number; pts: number }
export interface Objective extends ObjectiveSpec { position: number }
/** Esito dell'obiettivo: voti ufficiali del personaggio, se l'ha centrato il Megafono, e chi della Folla ha preso i punti (chi ha votato il personaggio). */
export interface ObjectiveOutcome extends Objective { votes: number; megaHit: boolean; winners: PlayerId[] }
/** Esito della scommessa del Lui! a fine turno. */
export interface LuiOutcome { slot: LuiSlot; position: number; k: number; pts: number; /** Voti degli altri giocatori sulla carta del Lui!. */ others: number; hit: boolean; /** Variante «Il gregge», Imbroglio! (lo 0): chi ha votato la carta, con il voto annullato. */ trap?: boolean; caught?: PlayerId[]; /** Variante «Il gregge», soglia: segnalino del gregge e, se riesce, gli altri giocatori che hanno votato la carta e prendono i punti insieme al Megafono. */ herd?: boolean; shared?: PlayerId[];
  /** Variante PROPAGANDA: effetto del segnalino, carta che riceve il voto (Dirottamento!) e voti ufficiali di quella carta prima e dopo l'effetto. */
  effect?: LuiEffect; to?: number; before?: number; after?: number }

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
  /** Gioco base «Cade / Non cade»: i due segnalini e com'è andata. */
  marks?: MarkOutcome[] | null;
  /** PROPAGANDA: il pareggio è stato deciso da Spareggio!. */
  spareggio?: boolean;
  /** PROPAGANDA con obiettivi: obiettivo del Megafono e com'è andato. */
  objective?: ObjectiveOutcome | null;
}

export interface ScoreLine { kind: "voto" | "carta" | "lui" | "lui-mancato" | "lui-gregge" | "lui-folla" | "obiettivo" | "obiettivo-mancato" | "obiettivo-folla" | "mini-giusto" | "mini-veloce"; pts: number; pos: number; n?: number }

/** Il mini-gioco in corso: la carta pescata (accusatore / protagonista della storia) e l'eventuale accusa. */
export interface Mini {
  kind: MiniKind; cardId: CardId | null; text: string | null;
  /** Intervallo a tempo: le posizioni (1..6) dei personaggi nell'ordine in cui escono dal separé, due cicli completi (12 uscite). */
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
  /** Intervallo a tempo: chi ha votato, nell'ordine in cui i voti sono arrivati (il primo tra i vincitori prende +4). */
  voteOrder?: PlayerId[];
  miniResult?: MiniResult | null;
  /** Segnalini Lui! già spesi da ciascun giocatore (pubblico). */
  luiSpent?: Record<PlayerId, LuiSlot[]>;
  /** Variante «Il gregge» attiva. */
  gregge?: boolean;
  /** Gioco base «Cade / Non cade» e i due segnalini posati nel turno. */
  cnc?: boolean;
  marks?: LuiToken[] | null;
  /** Variante PROPAGANDA e obiettivi contrapposti. */
  propaganda?: boolean;
  objectives?: boolean;
  /** Obiettivo segreto del Megafono nel turno in corso (dall'apertura della Torre). */
  objective?: Objective | null;
  /** I 2 segnalini Lui! di questa partita (estratti a caso da un pool adatto al numero di giocatori, uguali per tutti). */
  luiSet?: LuiSpec[];
}

export type Action =
  | { type: "choosePhrase"; playerId: PlayerId; mode: "card"; index: number }
  | { type: "choosePhrase"; playerId: PlayerId; mode: "free"; text?: string }
  | { type: "playCard"; playerId: PlayerId; cardId: CardId }
  | { type: "placeLui"; playerId: PlayerId; slot: LuiSlot; position: number; to?: number }
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
  | { type: "luiPlaced"; position: number }
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
