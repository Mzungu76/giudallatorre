import { EngineError } from "./types.ts";
import type { Action, CardId, GameConfig, GameEvent, GameState, PhraseCard, PlayerId, TowerSlot, TurnResult } from "./types.ts";
import { randomInt, shuffle } from "./rng.ts";

export const MIN_PLAYERS = 3, MAX_PLAYERS = 8;
/** Malus del segnalino Lui! quando la scommessa fallisce. */
export const LUI_FAIL_MALUS = 1;
/** Lunghezza massima della frase inventata dal Megafono (limite tecnico, nessun filtro sui contenuti). */
export const MAX_PHRASE_CHARS = 80;
/** Lunghezza massima della frase che motiva il voto (regola da testare). */
export const MAX_REASON_CHARS = 80;
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
    megafonoSa: !!config.megafonoSa, justifyVotes: !!config.justifyVotes, herd: !!config.herd, mixPhrases: !!config.mixPhrases, handSize, rounds: roundsFor(n), totalTurns: n * roundsFor(n), turnNumber: 1,
    megafonoIndex: 0, phase: "PROCLAIM", hands: {}, drawPile: [], discardPile: [], phraseDraw: [], phraseDiscard: [],
    rng: config.seed | 0, proclaim: null, phrase: null, played: {}, deckCard: null, tower: [], lui: null, votes: {}, voteReasons: {},
    scores: Object.fromEntries(ids.map((i) => [i, 0])), megafonoTurns: Object.fromEntries(ids.map((i) => [i, 0])),
    lastResult: null, winners: null, goldenGoal: false, goldenTurns: 0,
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
  s.tower = []; s.lui = null; s.votes = {}; s.voteReasons = {};
  events.push({ type: "turnStarted", turn: s.turnNumber, megafonoId: megafonoOf(s) });
}

const mustBe = (s: GameState, phase: GameState["phase"]) => {
  if (s.phase === "GAME_OVER") throw new EngineError("GAME_OVER", "la partita è finita");
  if (s.phase !== phase) throw new EngineError("WRONG_PHASE", `fase attuale ${s.phase}, richiesta ${phase}`);
};
const known = (s: GameState, id: PlayerId) => { if (!s.playerIds.includes(id)) throw new EngineError("UNKNOWN_PLAYER", id); };
/** Chi deve giocare una carta in questo turno. */
export const requiredPlayers = (s: GameState): PlayerId[] => s.playerIds.filter((p) => s.megafonoSa || p !== megafonoOf(s));

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
      mustBe(s, "PLAY"); known(s, action.playerId);
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
      mustBe(s, "VOTE"); known(s, action.playerId);
      if (s.votes[action.playerId] !== undefined) throw new EngineError("ALREADY_DONE", "voto già espresso");
      checkPosition(s, action.position);
      if (s.justifyVotes) {
        const raw = action.reason;
        if (typeof raw !== "string") throw new EngineError("INVALID_CHOICE", "scrivi perché voti questo personaggio");
        const text = raw.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
        if (!text) throw new EngineError("INVALID_CHOICE", "scrivi perché voti questo personaggio");
        if (text.length > MAX_REASON_CHARS) throw new EngineError("INVALID_CHOICE", `motivazione troppo lunga (massimo ${MAX_REASON_CHARS} caratteri)`);
        s.voteReasons[action.playerId] = text;
      }
      s.votes[action.playerId] = action.position;
      events.push({ type: "voteCast", playerId: action.playerId });
      if (s.playerIds.every((p) => s.votes[p] !== undefined)) resolve(s, events);
      break;
    }
    case "advance": {
      mustBe(s, "RESULTS"); endTurn(s, events);
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
}

function resolve(s: GameState, events: GameEvent[]) {
  const counts: Record<number, number> = {};
  for (const p of s.playerIds) { const v = s.votes[p]!; counts[v] = (counts[v] ?? 0) + 1; }
  const top = Math.max(...Object.values(counts));
  const leaders = Object.keys(counts).map(Number).filter((k) => counts[k] === top);
  const mega = megafonoOf(s), tie = leaders.length > 1;
  // Regola: in caso di pareggio cade SEMPRE il personaggio votato dal Megafono.
  const fallen = tie ? s.votes[mega]! : leaders[0]!;
  const slot = s.tower.find((t) => t.position === fallen)!;
  const points: Record<PlayerId, number> = {}, reasons: Record<PlayerId, string[]> = {};
  for (const p of s.playerIds) { points[p] = 0; reasons[p] = []; }
  const give = (p: PlayerId, n: number, why: string) => { points[p]! += n; reasons[p]!.push(why); };
  // Regola del gregge: se il Megafono ha indovinato la carta che cade, i +2 dei votanti vanno solo a lui.
  const herd = s.herd && !!s.lui && s.lui.kind === "CADE" && s.lui.position === fallen;
  for (const p of s.playerIds) if (s.votes[p] === fallen) { if (herd && p !== mega) reasons[p]!.push("gregge"); else give(p, 2, "voto"); }
  if (slot.ownerId !== null) give(slot.ownerId, 2, "carta");
  if (s.lui) {
    if (s.lui.kind === "CADE" && s.lui.position === fallen) give(mega, 4, "lui-cade");
    if (s.lui.kind === "NON_CADE" && s.lui.position !== fallen) give(mega, 1, "lui-non-cade");
    // scommessa fallita: malus
    if (s.lui.kind === "CADE" && s.lui.position !== fallen) give(mega, -LUI_FAIL_MALUS, "lui-fallito");
    if (s.lui.kind === "NON_CADE" && s.lui.position === fallen) give(mega, -LUI_FAIL_MALUS, "lui-fallito");
  }
  for (const p of s.playerIds) s.scores[p]! += points[p]!;
  const result: TurnResult = { turn: s.turnNumber, megafonoId: mega, votes: Object.fromEntries(s.playerIds.map((p) => [p, s.votes[p]!])), counts, tie, fallenPosition: fallen,
    fallenCardId: slot.cardId, fallenOwnerId: slot.ownerId, lui: s.lui ? { ...s.lui } : null, points, reasons, voteReasons: { ...s.voteReasons }, herd };
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
  s.megafonoIndex = (s.megafonoIndex + 1) % n; s.turnNumber += 1;
  startTurn(s, events);
}
