import { applyAction, createGame, EngineError, megafonoOf, suggestAction, viewFor } from "@gdt/game-engine";
import type { Action, CardId, GameEvent, GameState, PhraseCard } from "@gdt/game-engine";
import type { ClientMessage, RoomInfoResponse, RoomOptionsDto, RoomStage, ServerMessage } from "@gdt/game-protocol";
import { constantTimeEqual, hashToken, newPlayerId, newToken } from "./security.ts";
import type { RandomBytes } from "./security.ts";

export interface PlayerRec { id: string; nickname: string; tokenHash: string; isHost: boolean; joinedAt: number }
export interface RoomData {
  code: string; createdAt: number; lastActivity: number; stage: RoomStage; finishedAt: number | null;
  options: RoomOptionsDto; seq: number; deadline: number | null; players: PlayerRec[]; game: GameState | null;
  /** Da quando l'host è disconnesso in lobby (null = presente). Dopo HOST_GRACE_MS il ruolo passa a un altro giocatore. */
  hostLostAt: number | null;
}
export interface Outbox {
  send: { to: string; msg: ServerMessage }[];
  close: { playerId: string; code: number; reason: string }[];
  persist: boolean; destroy: boolean;
  /** Eventi di gioco dell'ultima azione, per gli schermi condivisi (sola visione). */
  events?: GameEvent[];
}
export interface Deps { rng: RandomBytes; deck: CardId[]; phraseDeck: PhraseCard[] }

export class RoomError extends Error { constructor(public code: string, message: string) { super(message); } }

export const LIMITS = {
  maxPlayers: 8, minPlayers: 3,
  hostGraceMs: 60_000, lobbyIdleMs: 20 * 60_000, playingIdleMs: 6 * 3600_000, finishedMs: 30 * 60_000, resultsAutoMs: 15_000,
};
const emptyOut = (): Outbox => ({ send: [], close: [], persist: false, destroy: false });
const norm = (n: string) => n.normalize("NFKC").toLocaleLowerCase("it");

export class RoomCore {
  readonly connected = new Set<string>();
  constructor(public data: RoomData, private deps: Deps) {}

  static create(code: string, deps: Deps, now: number, p: { nickname: string; mode: "table" | "remote"; megafonoSa: boolean }) {
    const playerId = newPlayerId(deps.rng), token = newToken(deps.rng);
    const data: RoomData = {
      code, createdAt: now, lastActivity: now, stage: "LOBBY", finishedAt: null, seq: 0, deadline: null, game: null, hostLostAt: null,
      options: { megafonoSa: p.megafonoSa, mode: p.mode, turnTimerSec: 0, display: true },
      players: [{ id: playerId, nickname: p.nickname, tokenHash: hashToken(token), isHost: true, joinedAt: now }],
    };
    return { core: new RoomCore(data, deps), playerId, token };
  }

  // ---------- accesso ----------
  join(nickname: string, now: number) {
    const d = this.data;
    if (d.stage !== "LOBBY") throw new RoomError("GAME_STARTED", "la partita è già iniziata");
    if (d.players.length >= LIMITS.maxPlayers) throw new RoomError("ROOM_FULL", "la stanza è piena");
    if (d.players.some((p) => norm(p.nickname) === norm(nickname))) throw new RoomError("NICKNAME_TAKEN", "nickname già in uso in questa stanza");
    const playerId = newPlayerId(this.deps.rng), token = newToken(this.deps.rng);
    d.players.push({ id: playerId, nickname, tokenHash: hashToken(token), isHost: false, joinedAt: now });
    d.lastActivity = now; d.seq++;
    return { playerId, token, out: this.broadcastRoom({ ...emptyOut(), persist: true }) };
  }
  authenticate(token: string): string | null {
    const h = hashToken(token); let found: string | null = null;
    for (const p of this.data.players) if (constantTimeEqual(p.tokenHash, h)) found = p.id; // niente uscita anticipata
    return found;
  }
  publicInfo(): RoomInfoResponse {
    const d = this.data;
    return { exists: true, stage: d.stage, players: d.players.length, full: d.players.length >= LIMITS.maxPlayers, mode: d.options.mode };
  }

  // ---------- presenza ----------
  onConnect(playerId: string, now: number): Outbox {
    this.connected.add(playerId); this.data.lastActivity = now;
    if (this.data.players.some((p) => p.id === playerId && p.isHost)) this.data.hostLostAt = null;
    const out = emptyOut(); out.send.push(...this.snapshot(playerId));
    for (const p of this.data.players) if (p.id !== playerId && this.connected.has(p.id)) out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
    return out;
  }
  onDisconnect(playerId: string, now: number): Outbox {
    this.connected.delete(playerId); this.data.lastActivity = now;
    const d = this.data;
    if (d.stage === "LOBBY" && d.players.some((p) => p.id === playerId && p.isHost)) d.hostLostAt = now; // periodo di tolleranza prima del passaggio di ruolo
    return this.broadcastRoom({ ...emptyOut(), persist: d.hostLostAt === now });
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
    const d = this.data, out = emptyOut();
    if (!d.players.some((p) => p.id === playerId)) { out.send.push({ to: playerId, msg: { t: "error", code: "NOT_IN_ROOM", message: "non fai parte della stanza" } }); return out; }
    d.lastActivity = now;
    const err = (code: string, message: string, reqId?: string) => { out.send.push({ to: playerId, msg: { t: "error", code, message, ...(reqId ? { reqId } : {}) } }); return out; };
    const me = d.players.find((p) => p.id === playerId)!;
    switch (msg.t) {
      case "hello": case "ping": case "watch": return out;
      case "setOptions": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host cambia le opzioni");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "le opzioni si cambiano prima dell'avvio");
        if (msg.megafonoSa !== undefined) d.options.megafonoSa = msg.megafonoSa;
        if (msg.mode !== undefined) d.options.mode = msg.mode;
        if (msg.display !== undefined) d.options.display = msg.display;
        if (msg.turnTimerSec !== undefined) d.options.turnTimerSec = msg.turnTimerSec;
        d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "kick": {
        if (!me.isHost) return err("NOT_HOST", "solo l'host espelle");
        if (d.stage !== "LOBBY") return err("WRONG_STAGE", "si può espellere solo prima dell'avvio");
        if (msg.playerId === playerId) return err("INVALID_TARGET", "non puoi espellere te stesso");
        const target = d.players.find((p) => p.id === msg.playerId);
        if (!target) return err("INVALID_TARGET", "giocatore inesistente");
        d.players = d.players.filter((p) => p.id !== target.id); this.connected.delete(target.id);
        out.send.push({ to: target.id, msg: { t: "kicked" } }); out.close.push({ playerId: target.id, code: 4003, reason: "kicked" });
        d.seq++; out.persist = true; return this.broadcastRoom(out);
      }
      case "leave": {
        if (d.stage !== "LOBBY") { out.close.push({ playerId, code: 1000, reason: "leave" }); return out; }
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
        const { state, events } = createGame({ players: d.players.map((p) => ({ id: p.id, name: p.nickname })), seed, megafonoSa: d.options.megafonoSa, deck: this.deps.deck, phraseDeck: this.deps.phraseDeck });
        d.game = state; d.stage = "PLAYING"; d.seq++; this.armDeadline(now); out.persist = true;
        return this.broadcastGame(out, events);
      }
      case "act": {
        if (d.stage !== "PLAYING" || !d.game) return err("WRONG_STAGE", "la partita non è in corso", msg.reqId);
        const a = msg.action;
        if (a.type === "advance" && playerId !== megafonoOf(d.game) && !me.isHost) return err("NOT_ALLOWED", "solo il Megafono o l'host proseguono", msg.reqId);
        try { return this.applyGame(out, { ...a, playerId } as Action, now); }
        catch (e) { if (e instanceof EngineError) return err(e.code, e.message, msg.reqId); throw e; }
      }
    }
  }

  private applyGame(out: Outbox, action: Action, now: number): Outbox {
    const d = this.data, before = d.game!.phase;
    const { state, events } = applyAction(d.game!, action);
    d.game = state; d.seq++; out.persist = true;
    if (state.phase === "GAME_OVER") { d.stage = "FINISHED"; d.finishedAt = now; d.deadline = null; }
    else if (state.phase !== before) this.armDeadline(now);
    return this.broadcastGame(out, events);
  }
  private armDeadline(now: number) {
    const d = this.data, g = d.game; if (!g || g.phase === "GAME_OVER") { d.deadline = null; return; }
    if (g.phase === "RESULTS") d.deadline = now + LIMITS.resultsAutoMs;
    else d.deadline = d.options.turnTimerSec > 0 ? now + d.options.turnTimerSec * 1000 : null;
  }

  // ---------- timer e pulizia ----------
  tick(now: number): Outbox & { alarmAt: number | null } {
    const d = this.data; let out: Outbox = emptyOut();
    // pulizia stanze abbandonate / concluse
    const idle = now - d.lastActivity, noOne = this.connected.size === 0;
    if ((d.stage === "LOBBY" && noOne && idle > LIMITS.lobbyIdleMs) || (d.stage === "PLAYING" && noOne && idle > LIMITS.playingIdleMs) ||
        (d.stage === "FINISHED" && d.finishedAt !== null && now - d.finishedAt > LIMITS.finishedMs)) {
      out.destroy = true; return { ...out, alarmAt: null };
    }
    if (d.stage === "LOBBY" && d.hostLostAt !== null && now - d.hostLostAt >= LIMITS.hostGraceMs && this.promoteHost(out)) this.broadcastRoom(out);
    // scadenza di fase
    if (d.stage === "PLAYING" && d.game && d.deadline !== null && now >= d.deadline) {
      const g0 = d.game;
      if (g0.phase === "RESULTS") out = this.applyGame(out, { type: "advance" }, now);
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
  nextAlarm(): number | null {
    const d = this.data; const c: number[] = [];
    if (d.deadline !== null) c.push(d.deadline);
    if (d.stage === "LOBBY") { c.push(d.lastActivity + LIMITS.lobbyIdleMs + 1000); if (d.hostLostAt !== null) c.push(d.hostLostAt + LIMITS.hostGraceMs); }
    if (d.stage === "PLAYING") c.push(d.lastActivity + LIMITS.playingIdleMs + 1000);
    if (d.stage === "FINISHED" && d.finishedAt !== null) c.push(d.finishedAt + LIMITS.finishedMs + 1000);
    return c.length ? Math.min(...c) : null;
  }

  // ---------- messaggi in uscita ----------
  roomMsg(forPlayer: string): ServerMessage {
    const d = this.data, host = d.players.find((p) => p.isHost);
    return { t: "room", seq: d.seq, code: d.code, stage: d.stage, you: forPlayer, hostId: host?.id ?? "", options: { ...d.options },
      players: d.players.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, connected: this.connected.has(p.id) })) };
  }
  snapshot(playerId: string): { to: string; msg: ServerMessage }[] {
    const res = [{ to: playerId, msg: this.roomMsg(playerId) }];
    if (this.data.game) res.push({ to: playerId, msg: { t: "view", seq: this.data.seq, view: viewFor(this.data.game, playerId), events: [], deadline: this.data.deadline } });
    return res;
  }
  /** Messaggi per uno schermo condiviso: stanza e vista senza alcun dato privato (nessuna mano, voti e proprietari nascosti). */
  spectatorMessages(events: GameEvent[] = []): ServerMessage[] {
    const d = this.data; if (!d.options.display) return [];
    const room = this.roomMsg(""); const res: ServerMessage[] = [room];
    if (d.game) res.push({ t: "view", seq: d.seq, view: viewFor(d.game, ""), events, deadline: d.deadline });
    return res;
  }
  private broadcastRoom(out: Outbox): Outbox {
    for (const p of this.data.players) if (this.connected.has(p.id)) out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
    return out;
  }
  private broadcastGame(out: Outbox, events: GameEvent[]): Outbox {
    const d = this.data; out.events = events;
    for (const p of d.players) if (this.connected.has(p.id)) {
      out.send.push({ to: p.id, msg: this.roomMsg(p.id) });
      out.send.push({ to: p.id, msg: { t: "view", seq: d.seq, view: viewFor(d.game!, p.id), events, deadline: d.deadline } });
    }
    return out;
  }
}
