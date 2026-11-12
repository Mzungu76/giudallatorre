import { EngineError } from "./types.ts";
import { MINI_KINDS } from "./types.ts";
import type { Action, CardId, GameConfig, GameEvent, GameState, LuiSlot, LuiSpec, LuiToken, MiniKind, MiniResult, Objective, ObjectiveOutcome, ObjectiveSpec, PhraseCard, PlayerId, ScoreLine, TowerSlot, TurnResult } from "./types.ts";
import { randomInt, shuffle } from "./rng.ts";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 8;
/** Intervallo a tempo: 6 carte escono dal separé una alla volta (3 s l'una), tre giri completi. Il server dà il «via» dopo la presentazione (sipario, regole: MINI_INTRO_MS) e il conto alla rovescia. */
export const MINI_CARDS = 6, MINI_CYCLES = 3, MINI_SLOT_MS = 3000, MINI_INTRO_MS = 6000, MINI_COUNTDOWN_MS = 3000;
/** Punti dell'intervallo: uguali per le tre modalità. */
export const MINI_PTS = 2, MINI_FAST_PTS = 4;
/** Pool di segnalini Lui! adatti al numero di giocatori. La scommessa è "almeno k voti degli altri" (oppure nessun voto); i punti sono tarati sulla probabilità di riuscita (simulazioni con i bot, tools/analysis/lui-pool.ts): più è difficile, più paga. */
export function luiPool(n: number): LuiSpec[] {
  const pool: LuiSpec[] = [{ slot: "zero", k: 0, pts: 5 }, { slot: "k1", k: 1, pts: 4 }];
  if (n === 3) pool.push({ slot: "k2", k: 2, pts: 10 });
  else { pool.push({ slot: "k2", k: 2, pts: 7 }); pool.push({ slot: "k3", k: 3, pts: n === 4 ? 16 : 14 }); }
  return pool;
}
/** I segnalini della partita (2: lo 0 e una soglia a caso). Le partite salvate prima di questa versione non li hanno: si usano i primi due del pool. */
export const luiTokens = (s: GameState): LuiSpec[] => s.luiSet && s.luiSet.length ? s.luiSet : luiPool(s.playerIds.length).slice(0, 2);
/** Variante «Il gregge»: lo 0 diventa l'Imbroglio! (annulla i voti sulla sua carta; +3 al Megafono se ne annulla almeno uno); la soglia premia anche chi vota la carta. */
const greggeSpec = (sp: LuiSpec): LuiSpec => (sp.slot === "zero" ? { slot: "zero", k: 1, pts: IMBROGLIO_PTS, trap: true } : { ...sp, herd: true });
/** Punti del Megafono quando l'Imbroglio! annulla almeno un voto (tarati con le simulazioni dei bot: tools/analysis/imbroglio.ts). */
export const IMBROGLIO_PTS = 3;
/** Gioco base «Cade / Non cade»: i tre segnalini, sempre tutti a disposizione del Megafono, che ne posa uno per turno. */
export function cncPool(): LuiSpec[] {
  return [{ slot: "cade", k: 0, pts: 4, effect: "cade" }, { slot: "noncade", k: 0, pts: 2, effect: "noncade" }, { slot: "nulli", k: 0, pts: 0, effect: "nulli" }];
}
/**
 * Gioco base «Cade / Non cade»: conteggio. I voti sulla carta con VOTI NULLI! non valgono; cade la più votata; pareggio: se tra le pari c'è la carta con CADE
 * cade solo lei, altrimenti cadono tutte (il voto del Megafono non ha ruolo speciale). Funzione pura, la usano il motore e i bot.
 */
export function tallyMarks(positions: number[], votes: Record<PlayerId, number>, marks: { effect?: string; position: number }[]) {
  const nul = marks.find((m) => m.effect === "nulli")?.position ?? -1, cade = marks.find((m) => m.effect === "cade")?.position ?? -1;
  const counts: Record<number, number> = Object.fromEntries(positions.map((p) => [p, 0]));
  const annulled = Object.keys(votes).filter((p) => votes[p] === nul);
  for (const [p, v] of Object.entries(votes)) if (v !== nul) counts[v] = (counts[v] ?? 0) + 1;
  const top = Math.max(...Object.values(counts)), leaders = Object.keys(counts).map(Number).filter((k) => counts[k] === top).sort((x, y) => x - y);
  const tie = leaders.length > 1, cadeTie = tie && leaders.includes(cade), fallen = top === 0 ? [] : cadeTie ? [cade] : leaders;
  return { counts, annulled, tie, cadeTie, fallen };
}

/** Variante PROPAGANDA: i 6 segnalini di manipolazione, 3 positivi e 3 negativi. Non danno punti da soli: cambiano il conteggio dei voti. */
export function propagandaPool(n: number): { positive: LuiSpec[]; negative: LuiSpec[] } {
  return {
    positive: [{ slot: "pr", k: n <= 4 ? 1 : 2, pts: 0, effect: "propaganda", positive: true }, { slot: "sp", k: 0, pts: 0, effect: "spareggio", positive: true }, { slot: "in", k: 0, pts: 0, effect: "influenza", positive: true }],
    negative: [{ slot: "im", k: 0, pts: 0, effect: "imbroglio", positive: false }, { slot: "di", k: 1, pts: 0, effect: "dirottamento", positive: false }, { slot: "ce", k: 1, pts: 0, effect: "censura", positive: false }],
  };
}
/** PROPAGANDA, obiettivi contrapposti: quelli possibili con `n` giocatori (sui voti ufficiali di un personaggio). */
export function objectivePool(n: number): ObjectiveSpec[] {
  const out: ObjectiveSpec[] = [{ kind: "almeno", k: 2, pts: 4 }, { kind: "nessuno", k: 0, pts: 4 }, { kind: "esattamente", k: 2, pts: 4 }];
  if (n >= 4) out.push({ kind: "almeno", k: 3, pts: 5 });
  if (n >= 6) out.push({ kind: "almeno", k: 4, pts: 6 });
  return out;
}
/** L'obiettivo del Megafono è centrato con `v` voti ufficiali? (Se no, vale quello pubblico, il contrario.) */
export const objectiveHit = (o: ObjectiveSpec, v: number) => (o.kind === "almeno" ? v >= o.k : o.kind === "nessuno" ? v === 0 : v === o.k);

/**
 * Il conteggio dei voti con i segnalini: voti normali (Influenza!: quello del Megafono vale 2), voti annullati (Imbroglio!, anche quello del gregge),
 * voti aggiunti (Propaganda!), tolti (Censura!) o spostati (Dirottamento!). Poi chi cade: la più votata; pareggio: Spareggio! sulla carta in testa la fa cadere da sola,
 * altrimenti se il Megafono ha votato una delle pari merito cade solo la sua, se no cadono tutte. Funzione pura: la usano il motore e i bot.
 */
export function tallyVotes(positions: number[], votes: Record<PlayerId, number>, mega: PlayerId, spec?: LuiSpec, lui?: LuiToken | null) {
  const counts: Record<number, number> = Object.fromEntries(positions.map((p) => [p, 0])), eff = lui ? spec?.effect : undefined, pos = lui?.position ?? -1;
  const annulled = lui && (spec?.trap || eff === "imbroglio") ? Object.keys(votes).filter((p) => votes[p] === pos) : [];
  for (const [p, v] of Object.entries(votes)) if (!annulled.includes(p)) counts[v] = (counts[v] ?? 0) + (eff === "influenza" && p === mega ? 2 : 1);
  const before = eff === "influenza" ? counts[votes[mega]!]! - 1 : eff === "imbroglio" ? Object.values(votes).filter((v) => v === pos).length : counts[pos] ?? 0;
  if (eff === "propaganda") counts[pos]! += spec!.k;
  else if ((eff === "censura" || eff === "dirottamento") && counts[pos]! > 0) { counts[pos]! -= 1; if (eff === "dirottamento" && lui!.to) counts[lui!.to] = (counts[lui!.to] ?? 0) + 1; }
  const after = eff === "influenza" ? counts[votes[mega]!]! : counts[pos] ?? 0;
  const top = Math.max(...Object.values(counts)), leaders = Object.keys(counts).map(Number).filter((k) => counts[k] === top).sort((x, y) => x - y);
  const tie = leaders.length > 1, megaVote = votes[mega]!, spareggio = tie && eff === "spareggio" && leaders.includes(pos);
  const tieBreak = tie && !spareggio && leaders.includes(megaVote);
  const fallen = spareggio ? [pos] : tieBreak ? [megaVote] : leaders;
  return { counts, annulled, before, after, top, tie, tieBreak, spareggio, fallen };
}

/** Segnalini ancora disponibili per un giocatore (se li ha spesi tutti, tornano tutti: spareggio). */
export function luiAvailable(s: GameState, p: PlayerId): LuiSlot[] {
  const all = luiTokens(s).map((x) => x.slot), spent = s.luiSpent?.[p] ?? [], left = all.filter((x) => !spent.includes(x));
  return left.length ? left : all;
}
/** Variante «Il gregge»: il Megafono non può votare la carta su cui ha posato il Lui!. Restituisce quella posizione (o null). */
export const luiForbidden = (s: GameState, p: PlayerId): number | null => {
  if (p !== megafonoOf(s)) return null;
  if (s.cnc) return s.marks?.find((m) => m.slot === "nulli")?.position ?? null;   // «Cade / Non cade»: il Megafono non vota la carta con VOTI NULLI!
  return s.gregge && s.lui ? s.lui.position : null;
};
/** Lunghezza massima della frase inventata dal Megafono (limite tecnico, nessun filtro sui contenuti). */
export const MAX_PHRASE_CHARS = 80;
/** Limite di sicurezza ai turni di spareggio: oltre, la vittoria resta condivisa. */
export const GOLDEN_GOAL_MAX_TURNS = 30;
/** 3 giocatori: 2 giri di Megafono a testa (6 turni); da 4 a 8: 1 giro, cioè tanti turni quanti sono i giocatori. */
export const roundsFor = (n: number) => (n === 3 ? 2 : 1);
/** Turni dopo cui c'è un intervallo (mini-gioco): 1 fino a 5 giocatori (a metà), 2 da 6 a 8 (a un terzo e a due terzi). */
export function miniAtsFor(n: number): number[] {
  const total = n * roundsFor(n);
  return n <= 5 ? [Math.floor(total / 2)] : [Math.floor(total / 3), Math.floor((2 * total) / 3)];
}
const miniList = (s: GameState): number[] => s.miniAts ?? (s.miniAt !== undefined ? [s.miniAt] : []);
const minisDone = (s: GameState): number => s.minisDone ?? (s.miniDone ? 1 : 0);

/** Mescola le frasi di tutte le carte a più frasi (ognuna col proprio contesto) e le rimette in gruppi da 5; le carte a frase singola restano intere. */
function mixPhrases(cards: PhraseCard[], s: GameState): PhraseCard[] {
  const multi = cards.filter((c) => c.phrases.length > 1), single = cards.filter((c) => c.phrases.length <= 1);
  const items = shuffle(multi.flatMap((c) => c.phrases.map((p, i) => ({ p, t: c.themes?.[i] ?? c.theme }))), s), out: PhraseCard[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const g = items.slice(i, i + 5);
    out.push({ id: `mix-${i / 5 + 1}`, phrases: g.map((x) => x.p), ...(g.every((x) => x.t) ? { themes: g.map((x) => x.t!) } : {}) });
  }
  return shuffle([...out, ...single], s);
}

export function createGame(config: GameConfig): { state: GameState; events: GameEvent[] } {
  const n = config.players.length, handSize = config.handSize ?? 5;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new EngineError("INVALID_PLAYERS", `servono da ${MIN_PLAYERS} a ${MAX_PLAYERS} giocatori`);
  const ids = config.players.map((p) => p.id);
  if (new Set(ids).size !== n) throw new EngineError("INVALID_PLAYERS", "identificativi duplicati");
  if (new Set(config.deck).size !== config.deck.length) throw new EngineError("INVALID_DECK", "carte duplicate nel mazzo");
  if (config.deck.length < n * handSize + n) throw new EngineError("INVALID_DECK", "mazzo troppo piccolo");
  if (config.phraseDeck.length < 1 || config.phraseDeck.some((c) => c.phrases.length < 1)) throw new EngineError("INVALID_DECK", "mazzo frasi non valido");
  const s: GameState = {
    version: 1, playerIds: ids, names: Object.fromEntries(config.players.map((p) => [p.id, p.name])),
    megafonoSa: !!config.megafonoSa || (!!config.cnc && !config.gregge && !config.propaganda), cnc: !!config.cnc && !config.gregge && !config.propaganda, marks: null, gregge: !!config.gregge && !config.propaganda, propaganda: !!config.propaganda, objectives: !!config.propaganda && !!config.objectives, objective: null, mixPhrases: !!config.mixPhrases, handSize, rounds: roundsFor(n), totalTurns: n * roundsFor(n), turnNumber: 1,
    megafonoIndex: 0, phase: "PROCLAIM", hands: {}, drawPile: [], discardPile: [], phraseDraw: [], phraseDiscard: [],
    rng: config.seed | 0, proclaim: null, phrase: null, played: {}, deckCard: null, tower: [], lui: null, votes: {},
    scores: Object.fromEntries(ids.map((i) => [i, 0])), megafonoTurns: Object.fromEntries(ids.map((i) => [i, 0])),
    lastResult: null, winners: null, goldenGoal: false, goldenTurns: 0,
    miniGame: config.miniGame ?? false, accuseDeck: (config.accuseDeck ?? []).slice(), miniAt: miniAtsFor(n)[0]!, miniAts: miniAtsFor(n), minisDone: 0, miniKinds: [], miniDone: false, mini: null, miniResult: null, luiSpent: Object.fromEntries(ids.map((i) => [i, [] as LuiSlot[]])), luiSet: [],
  };
  // i due segnalini: sempre lo 0 (senza, chi si sente minacciato non voterebbe mai la carta del Lui!) più una soglia a caso
  s.luiSet = config.luiSlots ? luiPool(n).filter((x) => config.luiSlots!.includes(x.slot)) : [luiPool(n).find((x) => x.slot === "zero")!, shuffle(luiPool(n).filter((x) => x.slot !== "zero"), s)[0]!];
  if (s.gregge) s.luiSet = s.luiSet.map(greggeSpec);
  if (s.cnc) s.luiSet = cncPool();
  // PROPAGANDA: un segnalino positivo e uno negativo a caso, uguali per tutti i Megafoni della partita
  if (s.propaganda) { const pp = propagandaPool(n); s.luiSet = config.luiSlots ? [...pp.positive, ...pp.negative].filter((x) => config.luiSlots!.includes(x.slot)) : [shuffle(pp.positive, s)[0]!, shuffle(pp.negative, s)[0]!]; }
  s.drawPile = shuffle(config.deck, s);
  s.phraseDraw = s.mixPhrases ? mixPhrases(config.phraseDeck, s) : shuffle(config.phraseDeck, s);
  for (const id of ids) s.hands[id] = [];
  for (let k = 0; k < handSize; k++) for (const id of ids) s.hands[id]!.push(draw(s));
  s.megafonoIndex = config.firstMegafonoIndex ?? randomInt(n, s);
  if (s.megafonoIndex < 0 || s.megafonoIndex >= n) throw new EngineError("INVALID_PLAYERS", "primo Megafono non valido");
  const events: GameEvent[] = [];
  startTurn(s, events);
  return { state: s, events };
}

export const megafonoOf = (s: GameState): PlayerId => s.playerIds[s.megafonoIndex]!;

/** Testo che vedono tutti. Una confessione («Ammetto…») in app nomina chi la pronuncia: «Marco ammette…». Il Megafono la legge in prima persona dalla propria carta. */
export const publicText = (s: GameState, megafono: PlayerId, text: string): string => /^Ammetto\b/.test(text) ? `${s.names[megafono]!} ammette${text.slice("Ammetto".length)}` : text;

function draw(s: GameState): CardId {
  if (s.drawPile.length === 0) {
    s.drawPile = shuffle(s.discardPile, s); s.discardPile = [];
    if (s.drawPile.length === 0) throw new EngineError("DECK_EXHAUSTED", "nessuna carta Personaggio disponibile");
  }
  return s.drawPile.shift()!;
}
function drawPhrase(s: GameState) {
  if (s.phraseDraw.length === 0) { s.phraseDraw = s.mixPhrases ? mixPhrases(s.phraseDiscard, s) : shuffle(s.phraseDiscard, s); s.phraseDiscard = []; }
  return s.phraseDraw.shift()!;
}

function startTurn(s: GameState, events: GameEvent[]) {
  s.phase = "PROCLAIM"; s.proclaim = drawPhrase(s); s.phrase = null; s.played = {}; s.deckCard = null; if (s.propaganda) s.objective = null;
  s.tower = []; s.lui = null; s.votes = {}; if (s.cnc) s.marks = null;
  events.push({ type: "turnStarted", turn: s.turnNumber, megafonoId: megafonoOf(s) });
}

const mustBe = (s: GameState, phase: GameState["phase"]) => {
  if (s.phase === "GAME_OVER") throw new EngineError("GAME_OVER", "la partita è finita");
  if (s.phase !== phase) throw new EngineError("WRONG_PHASE", `fase attuale ${s.phase}, richiesta ${phase}`);
};
const known = (s: GameState, id: PlayerId) => { if (!s.playerIds.includes(id)) throw new EngineError("UNKNOWN_PLAYER", id); };
/** Chi deve giocare una carta in questo turno. */
export const requiredPlayers = (s: GameState): PlayerId[] => s.phase.startsWith("MINI") ? s.playerIds.slice() : s.playerIds.filter((p) => s.megafonoSa || p !== megafonoOf(s));

/** Applica un'azione. Non modifica lo stato di input: restituisce un nuovo stato. Lancia EngineError se illegale. */
export function applyAction(prev: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const s = structuredClone(prev), events: GameEvent[] = [];
  switch (action.type) {
    case "choosePhrase": {
      mustBe(s, "PROCLAIM"); known(s, action.playerId);
      if (action.playerId !== megafonoOf(s)) throw new EngineError("NOT_ALLOWED", "solo il Megafono sceglie la frase");
      const card = s.proclaim!;
      if (action.mode === "card") {
        const idx = action.index;
        if (!Number.isInteger(idx) || idx < 0 || idx >= card.phrases.length) throw new EngineError("INVALID_CHOICE", "frase inesistente");
        if (card.phrases.length === 1 && idx !== 0) throw new EngineError("INVALID_CHOICE", "carta a frase singola: va pronunciata");
        s.phrase = { mode: "card", cardId: card.id, index: idx, text: publicText(s, action.playerId, card.phrases[idx]!), ...((card.themes?.[idx] ?? card.theme) ? { theme: (card.themes?.[idx] ?? card.theme)! } : {}) };
        events.push({ type: "phraseChosen", mode: "card", text: s.phrase.text });
      } else {
        const raw = action.text, text = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim() : "";
        if (raw !== undefined && typeof raw !== "string") throw new EngineError("INVALID_CHOICE", "testo non valido");
        if (text.length > MAX_PHRASE_CHARS) throw new EngineError("INVALID_CHOICE", `frase troppo lunga (massimo ${MAX_PHRASE_CHARS} caratteri)`);
        s.phrase = text ? { mode: "free", text } : { mode: "free" }; events.push({ type: "phraseChosen", mode: "free", ...(text ? { text } : {}) });
      }
      s.phraseDiscard.push(card); s.proclaim = null;
      if (!s.megafonoSa) s.deckCard = draw(s);
      s.phase = "PLAY";
      break;
    }
    case "playCard": {
      mustBe(s, "PLAY");
      known(s, action.playerId);
      if (!requiredPlayers(s).includes(action.playerId)) throw new EngineError("NOT_ALLOWED", "il Megafono non gioca carte in questa modalità");
      if (s.played[action.playerId] !== undefined) throw new EngineError("ALREADY_DONE", "carta già giocata");
      const hand = s.hands[action.playerId]!, i = hand.indexOf(action.cardId);
      if (i < 0) throw new EngineError("CARD_NOT_IN_HAND", action.cardId);
      hand.splice(i, 1); s.played[action.playerId] = action.cardId;
      events.push({ type: "cardPlayed", playerId: action.playerId });
      if (requiredPlayers(s).every((p) => s.played[p] !== undefined)) revealTower(s, events);
      break;
    }
    case "placeMarks": {
      // «Cade / Non cade»: un solo segnalino, scelto tra i tre
      mustBe(s, "SUSPECT"); known(s, action.playerId);
      if (!s.cnc) throw new EngineError("INVALID_CHOICE", "in questa modalità si posa un solo segnalino");
      if (action.playerId !== megafonoOf(s)) throw new EngineError("NOT_ALLOWED", "solo il Megafono posa i segnalini");
      const ms = Array.isArray(action.marks) ? action.marks : [];
      if (ms.length !== 1) throw new EngineError("INVALID_CHOICE", "va posato un solo segnalino");
      for (const m of ms) { if (!luiTokens(s).some((x) => x.slot === m.slot)) throw new EngineError("INVALID_CHOICE", "segnalino non valido"); checkPosition(s, m.position); }
      s.marks = ms.map((m) => ({ slot: m.slot, position: m.position })); s.phase = "VOTE";
      events.push({ type: "marksPlaced", positions: ms.map((m) => m.position) });
      break;
    }
    case "placeLui": {
      mustBe(s, "SUSPECT"); known(s, action.playerId);
      if (s.cnc) throw new EngineError("INVALID_CHOICE", "nel gioco base si usa placeMarks");
      if (action.playerId !== megafonoOf(s)) throw new EngineError("NOT_ALLOWED", "solo il Megafono posa il segnalino");
      if (!luiTokens(s).some((x) => x.slot === action.slot)) throw new EngineError("INVALID_CHOICE", "segnalino non valido");
      if (!luiAvailable(s, action.playerId).includes(action.slot)) throw new EngineError("INVALID_CHOICE", "segnalino già usato");
      checkPosition(s, action.position);
      const spec = luiTokens(s).find((x) => x.slot === action.slot)!;
      if (spec.effect === "dirottamento") {
        // Dirottamento!: il Megafono sceglie subito anche la carta che riceve il voto spostato (un'altra)
        if (action.to === undefined) throw new EngineError("INVALID_CHOICE", "scegli la carta che riceve il voto");
        checkPosition(s, action.to);
        if (action.to === action.position) throw new EngineError("INVALID_CHOICE", "il voto va spostato su un'altra carta");
      }
      s.lui = spec.effect === "dirottamento" ? { slot: action.slot, position: action.position, to: action.to! } : { slot: action.slot, position: action.position }; s.phase = "VOTE";
      events.push({ type: "luiPlaced", position: action.position });
      break;
    }
    case "vote": {
      if (s.phase !== "MINI_RUN") mustBe(s, "VOTE");
      known(s, action.playerId);
      if (s.votes[action.playerId] !== undefined) throw new EngineError("ALREADY_DONE", "voto già espresso");
      checkPosition(s, action.position);
      if (s.phase === "VOTE" && luiForbidden(s, action.playerId) === action.position) throw new EngineError("INVALID_CHOICE", s.cnc ? "non puoi votare la carta con Voti nulli!" : "non puoi votare la carta del tuo Lui!");
      s.votes[action.playerId] = action.position;
      if (s.phase === "MINI_RUN") (s.voteOrder ??= []).push(action.playerId);
      events.push({ type: "voteCast", playerId: action.playerId });
      if (s.playerIds.every((p) => s.votes[p] !== undefined)) { if (s.phase === "MINI_RUN") resolveMini(s, events); else resolve(s, events); }
      break;
    }
    case "endRun": {
      mustBe(s, "MINI_RUN"); resolveMini(s, events);
      break;
    }
    case "advance": {
      if (s.phase === "MINI_RESULTS") endMini(s, events); else { mustBe(s, "RESULTS"); endTurn(s, events); }
      break;
    }
    default: throw new EngineError("INVALID_CHOICE", "azione sconosciuta");
  }
  return { state: s, events };
}

function checkPosition(s: GameState, pos: number) {
  if (!Number.isInteger(pos) || pos < 1 || pos > s.tower.length) throw new EngineError("INVALID_POSITION", String(pos));
}

function revealTower(s: GameState, events: GameEvent[]) {
  const raw: { cardId: CardId; ownerId: PlayerId | null }[] = requiredPlayers(s).map((p) => ({ cardId: s.played[p]!, ownerId: p }));
  if (s.deckCard !== null) raw.push({ cardId: s.deckCard, ownerId: null });
  s.tower = shuffle(raw, s).map((r, i): TowerSlot => ({ position: i + 1, ...r }));
  s.played = {}; s.deckCard = null;
  s.phase = "SUSPECT"; events.push({ type: "towerRevealed", positions: s.tower.length });
  // PROPAGANDA con obiettivi: il Megafono riceve il suo obiettivo segreto (un personaggio a caso della Torre) prima di posare il Lui!
  if (s.phase === "SUSPECT" && s.propaganda && s.objectives) { const pool = objectivePool(s.playerIds.length), o = pool[randomInt(pool.length, s)]!; s.objective = { ...o, position: 1 + randomInt(s.tower.length, s) }; }
}

function resolve(s: GameState, events: GameEvent[]) {
  if (s.cnc) { resolveCnc(s, events); return; }
  // Conteggio con i segnalini («Il gregge»: l'Imbroglio! annulla i voti sulla sua carta; PROPAGANDA: i 6 segnalini). Vedi tallyVotes.
  const mega = megafonoOf(s), megaVote = s.votes[mega]!, spec = s.lui ? luiTokens(s).find((x) => x.slot === s.lui!.slot) : undefined;
  const T = tallyVotes(s.tower.map((t) => t.position), Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!])), mega, spec, s.lui);
  const { annulled, tie, tieBreak, fallen } = T, counts: Record<number, number> = Object.fromEntries(Object.entries(T.counts).filter(([, v]) => v > 0));
  const slots = fallen.map((f) => s.tower.find((t) => t.position === f)!);
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of s.playerIds) { points[p] = 0; lines[p] = []; }
  const give = (p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number, n?: number) => { points[p]! += pts; lines[p]!.push(n === undefined ? { kind, pts, pos } : { kind, pts, pos, n }); };
  // Voto giusto: +2 a chi ha votato una carta caduta (Megafono compreso).
  for (const p of s.playerIds) if (!annulled.includes(p) && fallen.includes(s.votes[p]!)) give(p, 2, "voto", s.votes[p]!);
  const collected = s.playerIds.filter((p) => p !== mega && s.votes[p] === megaVote).length;
  for (const sl of slots) if (sl.ownerId !== null) give(sl.ownerId, 2, "carta", sl.position);
  // Segnalino Lui!: "almeno k voti degli ALTRI" sulla sua carta (lo 0: nessun voto degli altri). Il Megafono non perde punti se sbaglia, ma il segnalino è speso.
  let lui: TurnResult["lui"] = null;
  if (s.lui) {
    const spec = luiTokens(s).find((x) => x.slot === s.lui!.slot)!;
    const others = s.playerIds.filter((p) => p !== mega && s.votes[p] === s.lui!.position).length;
    if (spec.effect) {
      // PROPAGANDA: il segnalino non dà punti da solo; l'esito dice se ha cambiato qualcosa
      const e = spec.effect, hit = e === "propaganda" || e === "influenza" ? true : e === "spareggio" ? T.spareggio : e === "imbroglio" ? annulled.length > 0 : T.before > 0;
      lui = { slot: spec.slot, position: s.lui.position, k: spec.k, pts: 0, others, hit, effect: e, before: T.before, after: T.after, ...(s.lui.to ? { to: s.lui.to } : {}), ...(e === "imbroglio" ? { caught: annulled } : {}) };
    } else if (spec.trap) {
      // Imbroglio!: i voti sulla carta sono già stati annullati nel conteggio; se ne ha annullato almeno uno, il Megafono incassa i punti del gettone
      const hit = annulled.length > 0;
      lui = { slot: spec.slot, position: s.lui.position, k: spec.k, pts: spec.pts, others, hit, trap: true, caught: annulled };
      if (hit) give(mega, spec.pts, "lui", s.lui.position, others); else lines[mega]!.push({ kind: "lui-mancato", pts: 0, pos: s.lui.position, n: others });
    } else {
      const hit = spec.slot === "zero" ? others === 0 : others >= spec.k;
      lui = { slot: spec.slot, position: s.lui.position, k: spec.k, pts: spec.pts, others, hit };
      if (spec.herd) {
        // «Il gregge»: se la soglia riesce (almeno k voti degli altri, che cada o no) i punti vanno al Megafono (che non può votarla) e a tutti quelli che l'hanno votata
        const shared = hit ? s.playerIds.filter((p) => s.votes[p] === s.lui!.position) : [];
        if (hit) give(mega, spec.pts, "lui", s.lui.position, others); else lines[mega]!.push({ kind: "lui-mancato", pts: 0, pos: s.lui.position, n: others });
        for (const p of shared) give(p, spec.pts, "lui-gregge", s.lui.position, others);
        lui.herd = true; lui.shared = shared;
      } else if (hit) give(mega, spec.pts, "lui", s.lui.position, others); else lines[mega]!.push({ kind: "lui-mancato", pts: 0, pos: s.lui.position, n: others });
    }
    const spent = (s.luiSpent ??= {})[mega] ??= []; if (luiTokens(s).every((x) => spent.includes(x.slot))) spent.length = 0; spent.push(s.lui.slot);
  }
  // Obiettivi contrapposti: sui voti ufficiali del personaggio. Se il Megafono non lo centra, vale quello pubblico: punti a chi ha votato il personaggio (voto valido).
  let objective: ObjectiveOutcome | null = null;
  if (s.objective) {
    const o = s.objective, v = T.counts[o.position] ?? 0, megaHit = objectiveHit(o, v);
    const winners = megaHit ? [] : s.playerIds.filter((p) => p !== mega && !annulled.includes(p) && s.votes[p] === o.position);
    if (megaHit) give(mega, o.pts, "obiettivo", o.position, v); else lines[mega]!.push({ kind: "obiettivo-mancato", pts: 0, pos: o.position, n: v });
    for (const p of winners) give(p, o.pts, "obiettivo-folla", o.position, v);
    objective = { ...o, votes: v, megaHit, winners };
  }
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: TurnResult = { turn: s.turnNumber, megafonoId: mega, votes: Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!])), counts, tie, fallenPosition: fallen[0]!,
    fallenCardId: slots[0]!.cardId, fallenOwnerId: slots[0]!.ownerId, fallenPositions: fallen, fallenCardIds: slots.map((x) => x.cardId), fallenOwnerIds: slots.map((x) => x.ownerId), lui, points, lines, collected, megaVote, tieBreak, ...(s.propaganda ? { spareggio: T.spareggio, objective } : {}) };
  s.lastResult = result; s.phase = "RESULTS"; events.push({ type: "resolved", result });
}

/** Gioco base «Cade / Non cade»: conteggio, chi cade, punti. */
function resolveCnc(s: GameState, events: GameEvent[]) {
  const mega = megafonoOf(s), megaVote = s.votes[mega]!, marks = (s.marks ?? []).map((m) => ({ ...m, effect: luiTokens(s).find((x) => x.slot === m.slot)?.effect ?? "nulli" }));
  const votes = Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!]));
  const T = tallyMarks(s.tower.map((t) => t.position), votes, marks), { annulled, tie, fallen } = T;
  const counts: Record<number, number> = Object.fromEntries(Object.entries(T.counts).filter(([, v]) => v > 0));
  const slots = fallen.map((f) => s.tower.find((t) => t.position === f)!);
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of s.playerIds) { points[p] = 0; lines[p] = []; }
  const give = (p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number, n?: number) => { points[p]! += pts; lines[p]!.push(n === undefined ? { kind, pts, pos } : { kind, pts, pos, n }); };
  // voto giusto (voto valido) e carta caduta (anche quella del Megafono)
  for (const p of s.playerIds) if (!annulled.includes(p) && fallen.includes(s.votes[p]!)) give(p, 2, "voto", s.votes[p]!);
  for (const sl of slots) if (sl.ownerId !== null) give(sl.ownerId, 2, "carta", sl.position);
  // segnalini: CADE +4 se cade, NON CADE +2 se resta su, al Megafono (ovunque abbia votato, una volta sola) e a ognuno della Folla che l'ha votata
  const outs = marks.map((m) => {
    const fell = fallen.includes(m.position), voters = s.playerIds.filter((p) => p !== mega && !annulled.includes(p) && s.votes[p] === m.position);
    if (m.effect === "nulli") { const caught = annulled.slice(); return { slot: m.slot, effect: m.effect, position: m.position, hit: caught.length > 0, voters: [], caught }; }
    const hit = m.effect === "cade" ? fell : !fell, pts = m.effect === "cade" ? 4 : 2;
    if (hit) { give(mega, pts, "lui", m.position, voters.length); for (const p of voters) give(p, pts, "lui-folla", m.position); }
    else lines[mega]!.push({ kind: "lui-mancato", pts: 0, pos: m.position });
    return { slot: m.slot, effect: m.effect, position: m.position, hit, voters };
  });
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: TurnResult = { turn: s.turnNumber, megafonoId: mega, votes, counts, tie, fallenPosition: fallen[0] ?? 0,
    fallenCardId: slots[0]?.cardId ?? "", fallenOwnerId: slots[0]?.ownerId ?? null, fallenPositions: fallen, fallenCardIds: slots.map((x) => x.cardId), fallenOwnerIds: slots.map((x) => x.ownerId),
    lui: null, marks: outs, points, lines, collected: s.playerIds.filter((p) => p !== mega && s.votes[p] === megaVote).length, megaVote, tieBreak: T.cadeTie };
  s.lastResult = result; s.phase = "RESULTS"; events.push({ type: "resolved", result });
}

function endTurn(s: GameState, events: GameEvent[]) {
  const mega = megafonoOf(s);
  for (const t of s.tower) s.discardPile.push(t.cardId);
  // pesca 1 carta chi ha giocato (ordine di tavolo a partire dal giocatore dopo il Megafono: deterministico)
  const n = s.playerIds.length;
  for (let k = 1; k <= n; k++) {
    const p = s.playerIds[(s.megafonoIndex + k) % n]!;
    if (requiredPlayers(s).includes(p)) s.hands[p]!.push(draw(s));
  }
  s.megafonoTurns[mega]! += 1;
  events.push({ type: "turnEnded", turn: s.turnNumber });
  if (s.playerIds.every((p) => s.megafonoTurns[p]! >= s.rounds)) {
    // fine dei giri regolari: vince chi ha più punti; se più giocatori sono in testa si gioca a oltranza ("Golden goal")
    const best = Math.max(...Object.values(s.scores)), leaders = s.playerIds.filter((p) => s.scores[p] === best);
    if (leaders.length > 1 && s.goldenTurns < GOLDEN_GOAL_MAX_TURNS) {
      s.goldenGoal = true; s.goldenTurns += 1; s.totalTurns += 1;
      events.push({ type: "goldenGoal", leaders });
    } else {
      s.winners = leaders; s.phase = "GAME_OVER";
      s.tower = []; s.played = {}; s.deckCard = null; s.lui = null; s.votes = {}; if (s.cnc) s.marks = null;
      events.push({ type: "gameOver", winners: s.winners });
      return;
    }
  }
  if (s.miniGame && s.turnNumber === miniList(s)[minisDone(s)]) { startMini(s, events); return; }
  s.megafonoIndex = (s.megafonoIndex + 1) % n; s.turnNumber += 1;
  startTurn(s, events);
}

// ---------- mini-giochi di metà partita ----------
const GENERIC_ACCUSE = "Mi ha rubato il panino al prosciutto!";

/** Intervallo a tempo: si pescano i 6 personaggi dal mazzo (uguali per tutti, di nessuno), più la carta dell'accusatore / del partner, e si stabilisce l'ordine di uscita dal separé. Le mani non si toccano durante la corsa: si rinnovano alla fine (endMini). */
function startMini(s: GameState, events: GameEvent[]) {
  // a caso fra i mini-giochi non ancora usciti in questa partita (con due intervalli non si ripete lo stesso)
  const fresh = MINI_KINDS.filter((k) => !(s.miniKinds ?? []).includes(k)), pool = fresh.length ? fresh : MINI_KINDS;
  const kind: MiniKind = s.miniGame === "random" || !s.miniGame ? pool[randomInt(pool.length, s)]! : s.miniGame;
  (s.miniKinds ??= []).push(kind);
  s.tower = Array.from({ length: MINI_CARDS }, (_, i): TowerSlot => ({ position: i + 1, cardId: draw(s), ownerId: null }));
  const cardId = kind === "peggiore" ? null : draw(s);
  const deck = s.accuseDeck ?? [];
  const text = kind === "accusa" ? (deck.length ? deck[randomInt(deck.length, s)]! : GENERIC_ACCUSE) : null;
  // tre giri completi, ognuno in ordine nuovo e senza ripetere subito l'ultima carta del giro prima
  const positions = s.tower.map((t) => t.position), order: number[] = [];
  for (let c = 0; c < MINI_CYCLES; c++) {
    let cyc = shuffle(positions, s);
    if (order.length && cyc[0] === order[order.length - 1]) cyc = [...cyc.slice(1), cyc[0]!];
    order.push(...cyc);
  }
  s.mini = { kind, cardId, text, order }; s.miniResult = null; s.voteOrder = [];
  s.phase = "MINI_RUN"; s.played = {}; s.deckCard = null; s.lui = null; s.votes = {}; if (s.cnc) s.marks = null; s.phrase = null; s.proclaim = null;
  events.push({ type: "miniStarted", kind });
}

/** Punti dell'intervallo, uguali per le tre modalità: +2 a chi ha votato una carta in testa (a parità tutte le carte in testa), +4 al più veloce di loro. Chi non ha votato in tempo non prende nulla. Accusa e Peggiore: le carte in testa cadono; Storia d'amore: vincono e restano. */
function resolveMini(s: GameState, events: GameEvent[]) {
  const mini = s.mini!;
  const counts: Record<number, number> = {};
  for (const t of s.tower) counts[t.position] = 0;
  const voters = (s.voteOrder ?? []).filter((p) => s.votes[p] !== undefined);
  for (const p of voters) counts[s.votes[p]!] = (counts[s.votes[p]!] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts)), leaders = top === 0 ? [] : s.tower.map((t) => t.position).filter((k) => counts[k] === top);
  const fallen = mini.kind === "amore" ? [] : leaders;
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of s.playerIds) { points[p] = 0; lines[p] = []; }
  const give = (p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number) => { points[p]! += pts; lines[p]!.push({ kind, pts, pos }); };
  let fastest: PlayerId | null = null;
  for (const p of voters) { const v = s.votes[p]!; if (!leaders.includes(v)) continue; give(p, MINI_PTS, "mini-giusto", v); if (fastest === null) fastest = p; }
  if (fastest !== null) give(fastest, MINI_FAST_PTS, "mini-veloce", s.votes[fastest]!);
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: MiniResult = { kind: mini.kind, cardId: mini.cardId, text: mini.text, votes: Object.fromEntries(voters.map((p) => [p, s.votes[p]!])), counts, leaders, fallenPositions: fallen,
    fallenCardIds: fallen.map((k) => s.tower.find((t) => t.position === k)!.cardId), fastest, points, lines };
  s.miniResult = result; s.phase = "MINI_RESULTS"; events.push({ type: "miniResolved", result });
}

function endMini(s: GameState, events: GameEvent[]) {
  const n = s.playerIds.length;
  for (const t of s.tower) s.discardPile.push(t.cardId);
  if (s.mini?.cardId) s.discardPile.push(s.mini.cardId);
  s.tower = []; s.votes = {}; s.voteOrder = [];
  // alla fine dell'intervallo le mani si rinnovano: via le carte vecchie, 5 nuove a tutti (in ordine di tavolo, deterministico)
  for (const p of s.playerIds) { s.discardPile.push(...s.hands[p]!); s.hands[p] = []; }
  for (let k = 0; k < s.handSize; k++) for (let i = 1; i <= n; i++) s.hands[s.playerIds[(s.megafonoIndex + i) % n]!]!.push(draw(s));
  s.miniDone = true; s.minisDone = minisDone(s) + 1; s.mini = null; s.miniResult = null;
  events.push({ type: "turnEnded", turn: s.turnNumber });
  s.megafonoIndex = (s.megafonoIndex + 1) % n; s.turnNumber += 1;
  startTurn(s, events);
}
