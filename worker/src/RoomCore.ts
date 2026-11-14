import { applyAction, BOT_STYLES, buildPhraseDeck, chooseBotAction, planMiniVote, styleById, createGame, DEFAULT_AGE_BAND, EngineError, learnFromResult, megafonoOf, MINI_COUNTDOWN_MS, MINI_INTRO_MS, MINI_SLOT_MS, newBotMemory, suggestAction, viewFor } from "@gdt/game-engine";
import type { Action, BotLevel, BotMemory, CardId, GameEvent, GameState, PhraseCard, PoolConfession, PoolPhrase } from "@gdt/game-engine";
import { MAX_CHAT_CHARS } from "@gdt/game-protocol";
import type { ChatDto, ClientMessage, RoomInfoResponse, RoomOptionsDto, RoomStage, ServerMessage } from "@gdt/game-protocol";
import { constantTimeEqual, hashToken, newPlayerId, newToken } from "./security.ts";
import type { RandomBytes } from "./security.ts";

export interface PlayerRec { id: string; nickname: string; tokenHash: string; isHost: boolean; joinedAt: number; isBot?: boolean; level?: BotLevel; /** Carattere del bot (id di BOT_STYLES), estratto a caso a ogni partita. */ style?: string; /** Personaggio (0–7: colore e segnalino), assegnato a caso tra gli otto quando entra in stanza. */ char?: number; /** Uscito a partita conclusa: resta in classifica ma non conta più come umano presente. */ left?: boolean }
export interface RoomData {
  code: string; createdAt: number; lastActivity: number; stage: RoomStage; finishedAt: number | null;
  options: RoomOptionsDto; seq: number; deadline: number | null; players: PlayerRec[]; game: GameState | null;
  /** Da quando l'host è disconnesso in lobby (null = presente). Dopo HOST_GRACE_MS il ruolo passa a un altro giocatore. */
  hostLostAt: number | null;
  /** Memoria dei giocatori virtuali (personaggi caduti) e prossimo istante in cui agiscono. */
  botMem: BotMemory; botAt: number | null;
  /** Messaggi tra i giocatori (ultimi CHAT_KEEP) e contatore per gli identificativi. */
  chat: ChatDto[]; chatSeq: number;
  /** Da quando non c'è più nessun umano connesso (null = c'è qualcuno). Da qui parte il conto per chiudere la stanza. */
  emptySince?: number | null;
  /** Un giocatore è uscito di sua volontà a partita iniziata: se la stanza si svuota si chiude con il margine breve. */
  leftExplicit?: boolean;
  /** Intervallo a tempo in corso: istante del «via!», fine della corsa e voti pianificati dei bot (posizione e istante). */
  run?: { goAt: number; endAt: number; bots: Record<string, { at: number; position: number }> } | null;
}
export interface Outbox {
  send: { to: string; msg: ServerMessage }[];
  close: { playerId: string; code: number; reason: string }[];
  persist: boolean; destroy: boolean;
  /** Eventi di gioco dell'ultima azione, per gli schermi condivisi (sola visione). */
  events?: GameEvent[];
}
export interface Deps {
  rng: RandomBytes; deck: CardId[]; accuseDeck?: string[];
  /** Mazzo già pronto (prove e strumenti). Se c'è la riserva sotto, all'avvio il mazzo si costruisce da quella, filtrato per età. */
  phraseDeck: PhraseCard[];
  phrasePool?: PoolPhrase[]; confessions?: PoolConfession[];
}

export class RoomError extends Error { constructor(public code: string, message: string) { super(message); } }

export const LIMITS = {
  maxPlayers: 6, minPlayers: 3,
  hostGraceMs: 60_000, lobbyIdleMs: 5 * 60_000, playingIdleMs: 45 * 60_000, maxLifeMs: 4 * 3600_000, finishedMs: 30 * 60_000, resultsAutoMs: 180_000, botMinMs: 900, botJitterMs: 1100, chatMinGapMs: 700, chatKeep: 60,
  /** Intervallo a tempo: un voto vale se arriva mentre il personaggio è in scena, con un po' di margine per la rete e i riflessi. */
  runEarlyMs: 300, runLateMs: 700, runEndGraceMs: 900, miniResultsAutoMs: 120_000,
};
const emptyOut = (): Outbox => ({ send: [], close: [], persist: false, destroy: false });
const norm = (n: string) => n.normalize("NFKC").toLocaleLowerCase("it");

/** I personaggi femminili (le altre sei facce sono maschili): i bot prendono un nome del loro sesso. */
export const FEMALE_CHARS = new Set([4, 7]);
export const BOT_NAMES_M = ["Gino", "Pino", "Tito", "Nino", "Beppe", "Enzo", "Mario", "Franco", "Rino", "Aldo", "Carlo", "Dino", "Elio", "Gigi", "Sandro", "Walter"].map((n) => `Bot ${n}`);
export const BOT_NAMES_F = ["Mara", "Lella", "Rosa", "Dora", "Gina", "Tina", "Lia", "Nina", "Wilma", "Elsa", "Bice", "Clara", "Ines", "Marta", "Silvia", "Vera"].map((n) => `Bot ${n}`);

/**
 * Il timer del turno parte dopo le animazioni: a ogni fase si aggiunge il tempo che i telefoni impiegano a mostrarle (cartello di fase,
 * salita delle carte, schede di inizio partita), così i secondi impostati restano tutti per scegliere. I telefoni mostrano il conto alla
 * rovescia solo da quando il tempo residuo scende sotto il timer impostato.
 */
export function animMs(g: GameState): number {
  const n = g.playerIds.length;
  switch (g.phase) {
    case "PROCLAIM": return 3_000 + (g.turnNumber === 1 ? 14_000 : 5_000);   // cartello + scheda «Sei il Megafono!» (+ carta personaggio ed estrazione alla prima mano)
    case "PLAY": return 3_000;
    case "SUSPECT": return Math.round(5_000 + n * 290) + 2_500;       // salita delle carte + cartello
    case "VOTE": return 3_000;
    default: return 0;
  }
}

export class RoomCore {
  readonly connected = new Set<string>();
  /** Ultimo istante passato dall'esterno (orologio del server): finisce nei messaggi per allineare i timer dell'app. */
  private clock = 0;
  private lastChat = new Map<string, number>();
  constructor(public data: RoomData, private deps: Deps) {
    data.options.ageBand ??= DEFAULT_AGE_BAND; data.botMem ??= newBotMemory(); data.botAt ??= null; data.chat ??= []; data.chatSeq ??= 0; data.emptySince ??= null; data.leftExplicit ??= false; data.run ??= null;
    data.players.forEach((p, i) => { p.char ??= data.players.some((q) => q.char === i % 8) ? this.freeChar() : i % 8; }); // stanze salvate prima di questa versione: personaggi in ordine di ingresso
  }
  private rnd(n: number): number { return new DataView(this.deps.rng(4).buffer).getUint32(0) % n; }
  /** Un carattere a caso tra quelli che nessun altro bot della stanza ha. */
  private freeStyle(): string {
    const used = new Set(this.data.players.map((q) => q.style)), free = BOT_STYLES.filter((x) => !used.has(x.id));
    return (free.length ? free : BOT_STYLES)[this.rnd(free.length || BOT_STYLES.length)]!.id;
  }
  /** Un personaggio a caso tra gli otto che nessuno in stanza ha già. */
  private freeChar(): number {
    const used = new Set(this.data.players.map((q) => q.char)), free = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !used.has(c));
    if (!free.length) return 0;
    return free[new DataView(this.deps.rng(4).buffer).getUint32(0) % free.length]!;
  }

  static create(code: string, deps: Deps, now: number, p: { nickname: string; debug?: boolean; char?: number; ageBand?: 6 | 10 | 14 | 18; turnTimerSec?: 0 | 30 | 60 | 90 | 120; bots?: { count: number; level: BotLevel } }) {
    const playerId = newPlayerId(deps.rng), token = newToken(deps.rng);
    const data: RoomData = {
      code, createdAt: now, lastActivity: now, stage: "LOBBY", finishedAt: null, seq: 0, deadline: null, game: null, hostLostAt: null,
      options: { ...(p.debug ? { debug: true } : {}), turnTimerSec: p.turnTimerSec ?? 0, display: true, ageBand: p.ageBand ?? DEFAULT_AGE_BAND }, botMem: newBotMemory(), botAt: null, chat: [], chatSeq: 0,
      players: [{ id: playerId, nickname: p.nickname, tokenHash: hashToken(token), isHost: true, joinedAt: now, ...(p.char !== undefined ? { char: p.char } : {}) }],
    };
    const core = new RoomCore(data, deps);
    for (let i = 0; i < (p.bots?.count ?? 0); i++) core.insertBot(p.bots!.level, now + i + 1);
    return { core, playerId, token };
  }
  private insertBot(level: BotLevel, now: number) {
    const d = this.data, used = new Set(d.players.map((q) => norm(q.nickname)));
    const char = this.freeChar(), names = FEMALE_CHARS.has(char) ? BOT_NAMES_F : BOT_NAMES_M;
    const free = names.filter((n) => !used.has(norm(n))), pool = free.length ? free : [...BOT_NAMES_M, ...BOT_NAMES_F].filter((n) => !used.has(norm(n)));
    const name = pool.length ? pool[this.rnd(pool.length)]! : `Bot ${d.players.length + 1}`;   // un nome diverso a ogni partita, del sesso della faccia
    d.players.push({ id: newPlayerId(this.deps.rng), nickname: name, tokenHash: "", isHost: false, joinedAt: now, isBot: true, level, char, style: this.freeStyle() });
  }

  // ---------- accesso ----------
  join(nickname: string, now: number, char?: number) {
    const d = this.data;
    if (d.stage !== "LOBBY") throw new RoomError("GAME_STARTED", "la partita è già iniziata");
    if (d.players.length >= LIMITS.maxPlayers) throw new RoomError("ROOM_FULL", "la stanza è piena");
    if (d.players.some((p) => norm(p.nickname) === norm(nickname))) throw new RoomError("NICKNAME_TAKEN", "nickname già in uso in questa stanza");
    const playerId = newPlayerId(this.deps.rng), token = newToken(this.deps.rng);
    d.players.push({ id: playerId, nickname, tokenHash: hashToken(token), isHost: false, joinedAt: now, char: char !== undefined && !d.players.some((q) => q.char === char) ? char : this.freeChar() });
    d.lastActivity = now; d.seq++;
    return { playerId, token, out: this.broadcastRoom({ ...emptyOut(), persist: true }) };
  }
  authenticate(token: string): string | null {
    const h = hashToken(token); let found: string | null = null;
    for (const p of this.data.players) if (!p.isBot && constantTimeEqual(p.tokenHash, h)) found = p.id; // niente uscita anticipata
    return found;
  }
  publicInfo(): RoomInfoResponse {
    const d = this.data;
    return { exists: true, stage: d.stage, players: d.players.length, full: d.players.length >= LIMITS.maxPlayers, taken: d.players.flatMap((p) => (p.char !== undefined ? [p.char] : [])) };
  }

  // ---------- presenza ----------
  onConnect(playerId: string, now: number): Outbox {
    this.clock = now;
    this.connected.add(playerId); const me0 = this.data.players.find((p) => p.id === playerId); if (me0) me0.left = false; this.data.lastActivity = now; this.data.emptySince = null; this.data.leftExplicit = false;
    if (this.data.players.some((p) => p.id === playerId && p.isHost)) this.data.hostLostAt = null;
    const out = emptyOut(); out.send.push(...this.snapshot(playerId));
    if (this.data.stage === "PLAYING" && this.data.botAt === null) { this.scheduleBots(now); out.persist = true; } // i bot riprendono quando torna un umano
    for (const p of this.data.players) if (p.id !== playerId && this.connected.has(p.id)) out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
    return out;
  }
  onDisconnect(playerId: string, now: number): Outbox {
    this.connected.delete(playerId); this.data.lastActivity = now;
    const d = this.data; let persist = false;
    if (d.stage === "LOBBY" && d.players.some((p) => p.id === playerId && p.isHost)) { d.hostLostAt = now; persist = true; } // periodo di tolleranza prima del passaggio di ruolo
    if (this.connected.size === 0) { d.emptySince = now; d.botAt = null; persist = true; } // nessun umano: i bot si fermano e parte il conto per chiudere la stanza
    return this.broadcastRoom({ ...emptyOut(), persist });
  }
  /** Passa il ruolo di host al primo giocatore connesso (più anziano). */
  private promoteHost(out: Outbox): boolean {
    const d = this.data, next = d.players.filter((p) => this.connected.has(p.id)).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!next) return false;
    for (const p of d.players) p.isHost = p.id === next.id;
    d.hostLostAt = null; d.seq++; out.persist = true; return true;
  }

  // ---------- messaggi ----------
  handle(playerId: string, msg: ClientMessage, now: number): Outbox {
    const d = this.data, out = emptyOut(); this.clock = now;
    if (!d.players.some((p) => p.id === playerId)) { out.send.push({ to: playerId, msg: { t: "error", code: "NOT_IN_ROOM", message: "non fai parte della stanza" } }); return out; }
    d.lastActivity = now;
    const err = (code: string, message: string, reqId?: string) => { out.send.push({ to: playerId, msg: { t: "error", code, message, ...(reqId ? { reqId } : {}) } }); return out; };
    const me = d.players.find((p) => p.id === playerId)!;
    switch (msg.t) {
      case "hello": case "ping": case "watch": return out;
      case "setOptions": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host cambia le opzioni");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "le opzioni si cambiano prima dell'avvio");
        if (msg.display !== undefined) d.options.display = msg.display;
        if (msg.turnTimerSec !== undefined) d.options.turnTimerSec = msg.turnTimerSec;
        if (msg.ageBand !== undefined) d.options.ageBand = msg.ageBand;
        d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "chat": {
        const text = msg.text.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_CHARS);
        if (!text) return err("INVALID_MESSAGE", "messaggio vuoto");
        const last = this.lastChat.get(playerId) ?? 0;
        if (now - last < LIMITS.chatMinGapMs) return err("RATE_LIMIT", "troppi messaggi ravvicinati");
        this.lastChat.set(playerId, now);
        d.chatSeq++; const m: ChatDto = { id: d.chatSeq, from: playerId, name: me.nickname, text, ts: now };
        d.chat.push(m); if (d.chat.length > LIMITS.chatKeep) d.chat.splice(0, d.chat.length - LIMITS.chatKeep);
        out.persist = true;
        for (const p of d.players) if (this.connected.has(p.id)) out.send.push({ to: p.id, msg: { t: "chat", msg: m } });
        return out;
      }
      case "addBot": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host aggiunge giocatori virtuali");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "i bot si aggiungono prima dell'avvio");
        if (d.players.length >= LIMITS.maxPlayers) return err("ROOM_FULL", "la stanza è piena");
        this.insertBot(msg.level, now); d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "removeBot": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host toglie i bot");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "i bot si tolgono prima dell'avvio");
        const b = d.players.find((p) => p.id === msg.playerId && p.isBot);
        if (!b) return err("INVALID_TARGET", "non è un bot");
        d.players = d.players.filter((p) => p.id !== b.id); d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "kick": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host espelle");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "si può espellere solo prima dell'avvio");
        if (msg.playerId === playerId) return err("INVALID_TARGET", "non puoi espellere te stesso");
        const target = d.players.find((p) => p.id === msg.playerId);
        if (!target) return err("INVALID_TARGET", "giocatore inesistente");
        if (target.isBot) { d.players = d.players.filter((p) => p.id !== target.id); d.seq++; out.persist = true; return this.broadcastRoom(out); }
        d.players = d.players.filter((p) => p.id !== target.id); this.connected.delete(target.id);
        out.send.push({ to: target.id, msg: { t: "kicked" } }); out.close.push({ playerId: target.id, code: 4003, reason: "kicked" });
        d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "leave": {
        if (d.stage !== "LOBBY") {
          // Partita in corso (o conclusa). Se nella stanza restano altri umani, chi esce viene sostituito da un giocatore virtuale (stesso posto, punti e carte);
          // se non ne restano, la stanza si chiude subito.
          const humansLeft = d.players.filter((p) => !p.isBot && !p.left && p.id !== playerId);
          this.connected.delete(playerId); out.close.push({ playerId, code: 1000, reason: "leave" });
          if (humansLeft.length === 0) { out.destroy = true; return out; }
          if (me.isHost) { me.isHost = false; (humansLeft.find((p) => this.connected.has(p.id)) ?? humansLeft[0]!).isHost = true; d.hostLostAt = null; }
          if (d.stage !== "PLAYING") me.left = true;
          if (d.stage === "PLAYING") {
            me.isBot = true; me.level = "medium"; me.style = this.freeStyle(); me.tokenHash = "";   // il vecchio token non entra più
            d.botAt = null; this.scheduleBots(now); this.planBots();
          }
          d.seq++; out.persist = true; return this.broadcastRoom(out);
        }
        d.players = d.players.filter((p) => p.id !== playerId); this.connected.delete(playerId);
        out.close.push({ playerId, code: 1000, reason: "leave" });
        if (d.players.length === 0) { out.destroy = true; return out; }
        if (me.isHost) { d.players[0]!.isHost = true; d.hostLostAt = null; }
        d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "start": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host avvia la partita");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "la partita è già avviata");
        if (d.players.length < LIMITS.minPlayers) return err("NOT_ENOUGH_PLAYERS", "servono almeno 3 giocatori");
        const seedBytes = this.deps.rng(4), seed = new DataView(seedBytes.buffer, seedBytes.byteOffset, 4).getInt32(0);
        const pool = this.deps.phrasePool;
        // con la riserva: mazzo costruito per questa stanza (età, famiglie miste, confessioni); senza: mazzo pronto, rimescolato in gruppi come prima
        const phraseDeck = pool ? buildPhraseDeck(pool, this.deps.confessions ?? [], { age: d.options.ageBand, seed: seed ^ 0x5bd1e995 }) : this.deps.phraseDeck;
        const { state, events } = createGame({ players: d.players.map((p) => ({ id: p.id, name: p.nickname })), seed, cnc: true, mixPhrases: !pool, deck: this.deps.deck, phraseDeck, miniGame: "random", accuseDeck: this.deps.accuseDeck ?? [] });
        d.game = state; d.stage = "PLAYING"; d.seq++; this.armDeadline(now); out.persist = true; d.botMem = newBotMemory();
        this.scheduleBots(now);
        return this.broadcastGame(out, events);
      }
      case "act": {
        if (d.stage !== "PLAYING" || !d.game) return err("WRONG_STAGE", "la partita non è in corso", msg.reqId);
        const a = msg.action;
        // intervallo a tempo: il voto vale solo per il personaggio che è in scena (o appena uscito) in questo momento
        if (a.type === "vote" && d.game.phase === "MINI_RUN" && !this.onStage(a.position, now)) return err("NOT_ON_STAGE", "quel personaggio non è in scena", msg.reqId);
        if (a.type === "advance" && playerId !== megafonoOf(d.game) && !me.isHost && !d.players.find((p) => p.id === megafonoOf(d.game!))?.isBot) return err("NOT_ALLOWED", "solo il Megafono o l'host proseguono", msg.reqId);
        try { return this.applyGame(out, { ...a, playerId } as Action, now); }
        catch (e) { if (e instanceof EngineError) return err(e.code, e.message, msg.reqId); throw e; }
      }
    }
  }

  private applyGame(out: Outbox, action: Action, now: number): Outbox {
    const d = this.data, before = d.game!.phase;
    const { state, events } = applyAction(d.game!, action);
    d.game = state; d.seq++; out.persist = true;
    if (state.phase === "MINI_RUN" && before !== "MINI_RUN") this.startRun(now);
    else if (state.phase !== "MINI_RUN" && d.run) d.run = null;
    if (state.phase === "RESULTS" && before !== "RESULTS" && state.lastResult) learnFromResult(d.botMem, state.tower, state.lastResult);
    this.scheduleBots(now);
    if (state.phase === "GAME_OVER") { d.stage = "FINISHED"; d.finishedAt = now; d.deadline = null; }
    else if (state.phase !== before) this.armDeadline(now);
    return this.broadcastGame(out, events);
  }
  /** Il personaggio `position` è in scena adesso? (finestra di uscita con un po' di margine per la rete e i riflessi) */
  private onStage(position: number, now: number): boolean {
    const d = this.data, run = d.run, order = d.game?.mini?.order; if (!run || !order) return false;
    return order.some((p, i) => { if (p !== position) return false; const t = run.goAt + i * MINI_SLOT_MS; return now >= t - LIMITS.runEarlyMs && now <= t + MINI_SLOT_MS + LIMITS.runLateMs; });
  }
  /** Inizia l'intervallo a tempo: presentazione, 3-2-1, «via!»; pianifica quando e chi votano i bot. */
  private startRun(now: number) {
    const d = this.data, order = d.game!.mini!.order, goAt = now + MINI_INTRO_MS + MINI_COUNTDOWN_MS;
    d.run = { goAt, endAt: goAt + order.length * MINI_SLOT_MS + LIMITS.runEndGraceMs, bots: {} };
    this.planBots();
  }
  /** Ogni bot che non ha ancora votato sceglie un personaggio e un istante in cui è in scena. */
  private planBots() {
    const d = this.data, g = d.game, run = d.run; if (!g || !run || g.phase !== "MINI_RUN") return;
    const rand = () => new DataView(this.deps.rng(4).buffer).getUint32(0) / 4294967296, order = g.mini!.order;
    for (const b of d.players.filter((p) => p.isBot)) {
      if (g.votes[b.id] !== undefined || run.bots[b.id]) continue;
      const pl = planMiniVote(g, b.id, b.level ?? "medium", d.botMem, rand, false, styleById(b.style));   // carta per carta e con il tempo di reazione di una persona
      if (pl) run.bots[b.id] = { position: pl.position, at: run.goAt + pl.slot * MINI_SLOT_MS + pl.delayMs };
    }
  }
  private armDeadline(now: number) {
    const d = this.data, g = d.game; if (!g || g.phase === "GAME_OVER") { d.deadline = null; return; }
    if (g.phase === "MINI_RUN") d.deadline = null;   // l'intervallo a tempo ha il suo orologio (d.run)
    else if (g.phase === "MINI_RESULTS") d.deadline = now + LIMITS.miniResultsAutoMs;   // sipario, scenetta finale e punti: serve più tempo
    else if (g.phase === "RESULTS") d.deadline = now + LIMITS.resultsAutoMs;
    else d.deadline = d.options.turnTimerSec > 0 ? now + animMs(g) + d.options.turnTimerSec * 1000 : null;
  }

  // ---------- timer e pulizia ----------
  tick(now: number): Outbox & { alarmAt: number | null } {
    const d = this.data; let out: Outbox = emptyOut(); this.clock = now;
    // pulizia stanze abbandonate / concluse / troppo vecchie
    const emptyAt = this.emptyAt(), grace = this.graceMs();
    if ((emptyAt !== null && (d.stage === "LOBBY" || d.stage === "PLAYING") && now - emptyAt > grace) ||
        (d.stage === "FINISHED" && d.finishedAt !== null && now - d.finishedAt > LIMITS.finishedMs) || now - d.createdAt > LIMITS.maxLifeMs) {
      out.destroy = true; return { ...out, alarmAt: null };
    }
    if (d.stage === "LOBBY" && d.hostLostAt !== null && now - d.hostLostAt >= LIMITS.hostGraceMs) {
      // Se non c'è nessun altro umano connesso non si può passare il ruolo: si smette di aspettare, altrimenti la scadenza resta nel passato e la stanza si risveglia ogni 50 ms.
      if (this.promoteHost(out)) this.broadcastRoom(out); else d.hostLostAt = null;
    }
    // intervallo a tempo: voti dei bot all'istante pianificato e, a fine corsa, il conteggio dei voti arrivati
    if (d.stage === "PLAYING" && d.game && d.game.phase === "MINI_RUN" && d.run) {
      const due = Object.entries(d.run.bots).filter(([, v]) => now >= v.at).sort((a, b) => a[1].at - b[1].at);
      for (const [id, v] of due) {
        if (d.game.phase !== "MINI_RUN") break;
        delete d.run!.bots[id];
        try { out = this.applyGame(out, { type: "vote", playerId: id, position: v.position }, now); } catch (e) { if (!(e instanceof EngineError)) throw e; }
      }
      if (d.game.phase === "MINI_RUN" && d.run && now >= d.run.endAt) out = this.applyGame(out, { type: "endRun" }, now);
    }
    // giocatori virtuali: un'azione a testa quando scade il loro ritardo
    if (d.stage === "PLAYING" && d.game && d.botAt !== null && now >= d.botAt) {
      d.botAt = null; const rand = () => new DataView(this.deps.rng(4).buffer).getUint32(0) / 4294967296;
      for (const b of d.players.filter((p) => p.isBot)) {
        if (!d.game || d.stage !== "PLAYING") break;
        const a = chooseBotAction(d.game, b.id, b.level ?? "medium", d.botMem, rand, styleById(b.style));
        if (a) { try { out = this.applyGame(out, a, now); } catch (e) { if (!(e instanceof EngineError)) throw e; } }
      }
      this.scheduleBots(now);
    }
    // scadenza di fase
    if (d.stage === "PLAYING" && d.game && d.deadline !== null && now >= d.deadline) {
      const g0 = d.game;
      if (g0.phase === "RESULTS" || g0.phase === "MINI_RESULTS") out = this.applyGame(out, { type: "advance" }, now);
      else {
        const rand = () => new DataView(this.deps.rng(4).buffer).getUint32(0) / 4294967296;
        for (let guard = 0; guard < 40 && d.game!.phase === g0.phase; guard++) {
          const missing = d.game!.playerIds.map((p) => suggestAction(d.game!, p, rand)).find((a) => a !== null);
          if (!missing) break;
          out = this.applyGame(out, missing, now);
        }
      }
    }
    return { ...out, alarmAt: this.nextAlarm() };
  }
  /** Programma la prossima azione dei bot se ce n'è almeno una disponibile (ritardo umano: 0,9–2 s). */
  private scheduleBots(now: number) {
    const d = this.data;
    if (d.stage !== "PLAYING" || !d.game || d.game.phase === "MINI_RUN" || !d.players.some((p) => p.isBot) || this.connected.size === 0) { d.botAt = null; return; }
    const g = d.game, any = d.players.some((p) => p.isBot && chooseBotAction(g, p.id, p.level ?? "medium", d.botMem, () => 0.5) !== null);
    if (!any) { d.botAt = null; return; }
    if (d.botAt === null) d.botAt = now + LIMITS.botMinMs + (new DataView(this.deps.rng(4).buffer).getUint32(0) / 4294967296) * LIMITS.botJitterMs;
  }
  /** Da quando la stanza è senza umani connessi (null se c'è qualcuno). Le stanze salvate prima di questo campo ripartono dall'ultima attività. */
  private emptyAt(): number | null { return this.connected.size === 0 ? (this.data.emptySince ?? this.data.lastActivity) : null; }
  /** Quanto si aspetta prima di chiudere una stanza vuota: poco in lobby o dopo un'uscita volontaria, di più a partita iniziata (telefoni in standby). */
  private graceMs(): number { const d = this.data; return d.stage === "PLAYING" && !d.leftExplicit ? LIMITS.playingIdleMs : LIMITS.lobbyIdleMs; }
  nextAlarm(): number | null {
    const d = this.data; const c: number[] = [];
    if (d.botAt !== null) c.push(d.botAt);
    if (d.deadline !== null) c.push(d.deadline);
    if (d.run && d.game?.phase === "MINI_RUN") { c.push(d.run.endAt); for (const v of Object.values(d.run.bots)) c.push(v.at); }
    const emptyAt = this.emptyAt();
    if (d.stage === "LOBBY") { if (emptyAt !== null) c.push(emptyAt + this.graceMs() + 1000); if (d.hostLostAt !== null) c.push(d.hostLostAt + LIMITS.hostGraceMs); }
    if (d.stage === "PLAYING" && emptyAt !== null) c.push(emptyAt + this.graceMs() + 1000);
    c.push(d.createdAt + LIMITS.maxLifeMs + 1000);
    if (d.stage === "FINISHED" && d.finishedAt !== null) c.push(d.finishedAt + LIMITS.finishedMs + 1000);
    return c.length ? Math.min(...c) : null;
  }

  // ---------- messaggi in uscita ----------
  roomMsg(forPlayer: string): ServerMessage {
    const d = this.data, host = d.players.find((p) => p.isHost);
    return { t: "room", seq: d.seq, code: d.code, stage: d.stage, you: forPlayer, hostId: host?.id ?? "", options: { ...d.options },
      players: d.players.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, connected: p.isBot ? true : this.connected.has(p.id), ...(p.char !== undefined ? { char: p.char } : {}), ...(p.isBot ? { isBot: true, level: p.level, ...(d.options.debug && p.style ? { style: p.style } : {}) } : {}) })) };
  }
  snapshot(playerId: string): { to: string; msg: ServerMessage }[] {
    const res: { to: string; msg: ServerMessage }[] = [{ to: playerId, msg: this.roomMsg(playerId) }];
    if (this.data.chat.length) res.push({ to: playerId, msg: { t: "chatlog", msgs: this.data.chat.slice() } });
    if (this.data.game) res.push({ to: playerId, msg: { t: "view", seq: this.data.seq, view: viewFor(this.data.game, playerId), events: [], deadline: this.data.deadline, now: this.clock, goAt: this.runGoAt() } });
    return res;
  }
  /** Messaggi per uno schermo condiviso: stanza e vista senza alcun dato privato (nessuna mano, voti e proprietari nascosti). */
  spectatorMessages(events: GameEvent[] = []): ServerMessage[] {
    const d = this.data; if (!d.options.display) return [];
    const room = this.roomMsg(""); const res: ServerMessage[] = [room];
    if (d.game) res.push({ t: "view", seq: d.seq, view: viewFor(d.game, ""), events, deadline: d.deadline, now: this.clock, goAt: this.runGoAt() });
    return res;
  }
  private runGoAt(): number | null { const d = this.data; return d.game?.phase === "MINI_RUN" && d.run ? d.run.goAt : null; }
  private broadcastRoom(out: Outbox): Outbox {
    for (const p of this.data.players) if (this.connected.has(p.id)) out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
    return out;
  }
  private broadcastGame(out: Outbox, events: GameEvent[]): Outbox {
    const d = this.data; out.events = events;
    for (const p of d.players) if (this.connected.has(p.id)) {
      out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
      out.send.push({ to: p.id, msg: { t: "view", seq: d.seq, view: viewFor(d.game!, p.id), events, deadline: d.deadline, now: this.clock, goAt: this.runGoAt() } });
    }
    return out;
  }
}
