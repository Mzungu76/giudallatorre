import { EngineError } from "./types.ts";
import { MINI_KINDS } from "./types.ts";
import type { Action, CardId, GameConfig, GameEvent, GameState, MiniKind, MiniResult, PhraseCard, PlayerId, ScoreLine, TowerSlot, TurnResult } from "./types.ts";
import { randomInt, shuffle } from "./rng.ts";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 8;
/** Malus del segnalino Lui! quando la scommessa fallisce. */
export const LUI_FAIL_MALUS = 1;
/** Lunghezza massima della frase inventata dal Megafono (limite tecnico, nessun filtro sui contenuti). */
export const MAX_PHRASE_CHARS = 80;
/** Limite di sicurezza ai turni di spareggio: oltre, la vittoria resta condivisa. */
export const GOLDEN_GOAL_MAX_TURNS = 30;
/** 3–5 giocatori: 2 giri di Megafono a testa; 6–8: 1 giro (regolamento). */
export const roundsFor = (n: number) => (n <= 5 ? 2 : 1);

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
    megafonoSa: !!config.megafonoSa, mixPhrases: !!config.mixPhrases, handSize, rounds: roundsFor(n), totalTurns: n * roundsFor(n), turnNumber: 1,
    megafonoIndex: 0, phase: "PROCLAIM", hands: {}, drawPile: [], discardPile: [], phraseDraw: [], phraseDiscard: [],
    rng: config.seed | 0, proclaim: null, phrase: null, played: {}, deckCard: null, tower: [], lui: null, votes: {},
    scores: Object.fromEntries(ids.map((i) => [i, 0])), megafonoTurns: Object.fromEntries(ids.map((i) => [i, 0])),
    lastResult: null, winners: null, goldenGoal: false, goldenTurns: 0,
    miniGame: config.miniGame ?? false, accuseDeck: (config.accuseDeck ?? []).slice(), miniAt: Math.floor((n * roundsFor(n)) / 2), miniDone: false, mini: null, miniResult: null,
  };
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
  s.phase = "PROCLAIM"; s.proclaim = drawPhrase(s); s.phrase = null; s.played = {}; s.deckCard = null;
  s.tower = []; s.lui = null; s.votes = {};
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
        s.phrase = { mode: "card", cardId: card.id, index: idx, text: card.phrases[idx]!, ...((card.themes?.[idx] ?? card.theme) ? { theme: (card.themes?.[idx] ?? card.theme)! } : {}) };
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
      if (s.phase !== "MINI_PLAY") mustBe(s, "PLAY"); else known(s, action.playerId);
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
    case "placeLui": {
      mustBe(s, "SUSPECT"); known(s, action.playerId);
      if (action.playerId !== megafonoOf(s)) throw new EngineError("NOT_ALLOWED", "solo il Megafono posa il segnalino");
      if (action.kind !== "CADE" && action.kind !== "NON_CADE") throw new EngineError("INVALID_CHOICE", "segnalino non valido");
      checkPosition(s, action.position);
      s.lui = { kind: action.kind, position: action.position }; s.phase = "VOTE";
      events.push({ type: "luiPlaced", position: action.position });
      break;
    }
    case "vote": {
      if (s.phase !== "MINI_VOTE") mustBe(s, "VOTE");
      known(s, action.playerId);
      if (s.votes[action.playerId] !== undefined) throw new EngineError("ALREADY_DONE", "voto già espresso");
      checkPosition(s, action.position);
      s.votes[action.playerId] = action.position;
      events.push({ type: "voteCast", playerId: action.playerId });
      if (s.playerIds.every((p) => s.votes[p] !== undefined)) { if (s.phase === "MINI_VOTE") resolveMini(s, events); else resolve(s, events); }
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
  s.phase = s.phase === "MINI_PLAY" ? "MINI_VOTE" : "SUSPECT"; events.push({ type: "towerRevealed", positions: s.tower.length });
}

function resolve(s: GameState, events: GameEvent[]) {
  const counts: Record<number, number> = {};
  for (const p of s.playerIds) { const v = s.votes[p]!; counts[v] = (counts[v] ?? 0) + 1; }
  const top = Math.max(...Object.values(counts));
  const leaders = Object.keys(counts).map(Number).filter((k) => counts[k] === top);
  const mega = megafonoOf(s), tie = leaders.length > 1, megaVote = s.votes[mega]!;
  // Cade la carta col maggior numero di voti; in caso di pareggio cadono insieme tutte le carte a pari merito (anche quella votata dal Megafono).
  const fallen = leaders.sort((x, y) => x - y);
  const slots = fallen.map((f) => s.tower.find((t) => t.position === f)!);
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of s.playerIds) { points[p] = 0; lines[p] = []; }
  const give = (p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number, n?: number) => { points[p]! += pts; lines[p]!.push(n === undefined ? { kind, pts, pos } : { kind, pts, pos, n }); };
  // Voto giusto: +2 a chi ha votato una carta caduta (Megafono compreso).
  for (const p of s.playerIds) if (fallen.includes(s.votes[p]!)) give(p, 2, "voto", s.votes[p]!);
  // Il Megafono incassa 1 punto per ogni voto degli altri sulla carta che ha votato, sia che cada sia che resti su (il suo voto non conta).
  const collected = s.playerIds.filter((p) => p !== mega && s.votes[p] === megaVote).length;
  if (collected > 0) give(mega, collected, "raccolti", megaVote, collected);
  for (const sl of slots) if (sl.ownerId !== null) give(sl.ownerId, 2, "carta", sl.position);
  if (s.lui) {
    const hit = fallen.includes(s.lui.position);
    if (s.lui.kind === "CADE" && hit) give(mega, 4, "lui-cade", s.lui.position);
    if (s.lui.kind === "NON_CADE" && !hit) give(mega, 1, "lui-non-cade", s.lui.position);
    // scommessa fallita: malus
    if (s.lui.kind === "CADE" && !hit) give(mega, -LUI_FAIL_MALUS, "lui-fallito", s.lui.position);
    if (s.lui.kind === "NON_CADE" && hit) give(mega, -LUI_FAIL_MALUS, "lui-fallito", s.lui.position);
  }
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: TurnResult = { turn: s.turnNumber, megafonoId: mega, votes: Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!])), counts, tie, fallenPosition: fallen[0]!,
    fallenCardId: slots[0]!.cardId, fallenOwnerId: slots[0]!.ownerId, fallenPositions: fallen, fallenCardIds: slots.map((x) => x.cardId), fallenOwnerIds: slots.map((x) => x.ownerId), lui: s.lui ? { ...s.lui } : null, points, lines, collected, megaVote };
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
      s.tower = []; s.played = {}; s.deckCard = null; s.lui = null; s.votes = {};
      events.push({ type: "gameOver", winners: s.winners });
      return;
    }
  }
  if (s.miniGame && !s.miniDone && s.turnNumber === s.miniAt) { startMini(s, events); return; }
  s.megafonoIndex = (s.megafonoIndex + 1) % n; s.turnNumber += 1;
  startTurn(s, events);
}

// ---------- mini-giochi di metà partita ----------
const GENERIC_ACCUSE = "Mi ha rubato il panino al prosciutto!";

/** Tutte le mani vengono rinnovate, si pesca la carta del mini-gioco e tutti giocano una carta. */
function startMini(s: GameState, events: GameEvent[]) {
  const kind: MiniKind = s.miniGame === "random" || !s.miniGame ? MINI_KINDS[randomInt(MINI_KINDS.length, s)]! : s.miniGame;
  for (const p of s.playerIds) { s.discardPile.push(...s.hands[p]!); s.hands[p] = []; }
  for (let k = 0; k < s.handSize; k++) for (const p of s.playerIds) s.hands[p]!.push(draw(s));
  const cardId = kind === "raccomandato" ? null : draw(s);
  const deck = s.accuseDeck ?? [];
  const text = kind === "accusa" ? (deck.length ? deck[randomInt(deck.length, s)]! : GENERIC_ACCUSE) : null;
  s.mini = { kind, cardId, text }; s.miniResult = null;
  s.phase = "MINI_PLAY"; s.played = {}; s.deckCard = null; s.tower = []; s.lui = null; s.votes = {}; s.phrase = null; s.proclaim = null;
  events.push({ type: "miniStarted", kind });
}

/** Punti del mini-gioco. Accusa / Storia d'amore: restano le carte in testa; chi le ha votate prende i voti ricevuti, chi le ha giocate il doppio; le altre cadono. Raccomandato: cadono le più votate e chi le aveva giocate perde i voti ricevuti. */
function resolveMini(s: GameState, events: GameEvent[]) {
  const mini = s.mini!, n = s.playerIds.length;
  const counts: Record<number, number> = {};
  for (const t of s.tower) counts[t.position] = 0;
  for (const p of s.playerIds) counts[s.votes[p]!] = (counts[s.votes[p]!] ?? 0) + 1;
  const top = Math.max(...Object.values(counts)), leaders = s.tower.map((t) => t.position).filter((k) => counts[k] === top);
  const raccomandato = mini.kind === "raccomandato";
  const fallen = raccomandato ? leaders : s.tower.map((t) => t.position).filter((k) => counts[k]! < top);
  const owners: Record<number, PlayerId> = {}; for (const t of s.tower) if (t.ownerId) owners[t.position] = t.ownerId;
  const points: Record<PlayerId, number> = {}, lines: Record<PlayerId, ScoreLine[]> = {};
  for (const p of s.playerIds) { points[p] = 0; lines[p] = []; }
  const remaining = Math.max(1, s.totalTurns - (s.miniAt ?? 0)), cap = Math.max(n, 2 * remaining);
  const give = (p: PlayerId, pts: number, kind: ScoreLine["kind"], pos: number) => { points[p]! += pts; lines[p]!.push({ kind, pts, pos }); };
  if (raccomandato) {
    for (const k of fallen) { const o = owners[k]; if (!o) continue; const loss = Math.min(counts[k]!, Math.max(0, s.scores[o]! + points[o]!)); if (loss > 0) give(o, -loss, "mini-perdita", k); }
  } else {
    for (const p of s.playerIds) { const v = s.votes[p]!; if (leaders.includes(v)) give(p, counts[v]!, "mini-voto", v); }
    for (const k of leaders) { const o = owners[k]; if (o) give(o, 2 * counts[k]!, "mini-carta", k); }
    for (const p of s.playerIds) if (points[p]! > cap) give(p, cap - points[p]!, "mini-tetto", 0);
  }
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: MiniResult = { kind: mini.kind, cardId: mini.cardId, text: mini.text, votes: Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!])), counts, leaders, fallenPositions: fallen,
    fallenCardIds: fallen.map((k) => s.tower.find((t) => t.position === k)!.cardId), owners, points, lines, cap };
  s.miniResult = result; s.phase = "MINI_RESULTS"; events.push({ type: "miniResolved", result });
}

function endMini(s: GameState, events: GameEvent[]) {
  const n = s.playerIds.length;
  for (const t of s.tower) s.discardPile.push(t.cardId);
  if (s.mini?.cardId) s.discardPile.push(s.mini.cardId);
  for (let k = 1; k <= n; k++) s.hands[s.playerIds[(s.megafonoIndex + k) % n]!]!.push(draw(s));
  s.miniDone = true; s.mini = null; s.miniResult = null;
  events.push({ type: "turnEnded", turn: s.turnNumber });
  s.megafonoIndex = (s.megafonoIndex + 1) % n; s.turnNumber += 1;
  startTurn(s, events);
}
