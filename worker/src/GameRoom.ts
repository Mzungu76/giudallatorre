import { DurableObject } from "cloudflare:workers";
import { clientMessageSchema, createRoomBody, joinRoomBody, MAX_MESSAGE_BYTES } from "@gdt/game-protocol";
import type { ServerMessage, SessionResponse } from "@gdt/game-protocol";
import type { GameEvent } from "@gdt/game-engine";
import { RoomCore, RoomError } from "./RoomCore.ts";
import type { Outbox, RoomData } from "./RoomCore.ts";
import { ACCUSE_DECK, CONFESSIONS, DECK, PHRASE_DECK, PHRASE_POOL } from "./content.ts";
import { TokenBucket, cryptoBytes } from "./security.ts";

export interface Env { GAME_ROOM: DurableObjectNamespace<GameRoom>; ASSETS: Fetcher }
interface Attachment { pid: string | null; at: number; spec?: boolean }
const UNAUTH_MS = 10_000;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export class GameRoom extends DurableObject<Env> {
  private core: RoomCore | null = null;
  private buckets = new Map<string, TokenBucket>();
  private strikes = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}')); // ping gratuiti: non svegliano l'oggetto
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
      const row = ctx.storage.sql.exec("SELECT v FROM kv WHERE k = 'room'").toArray()[0];
      if (row) {
        this.core = new RoomCore(JSON.parse(row.v as string) as RoomData, { rng: cryptoBytes, deck: DECK, phraseDeck: PHRASE_DECK, phrasePool: PHRASE_POOL, confessions: CONFESSIONS, accuseDeck: ACCUSE_DECK });
        for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment() as Attachment | null; if (a?.pid) this.core.connected.add(a.pid); }
      }
    });
  }

  private save() { if (this.core) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('room', ?)", JSON.stringify(this.core.data)); }
  private deps() { return { rng: cryptoBytes, deck: DECK, phraseDeck: PHRASE_DECK, phrasePool: PHRASE_POOL, confessions: CONFESSIONS, accuseDeck: ACCUSE_DECK }; }
  private spectators() { return this.ctx.getWebSockets().filter((w) => (w.deserializeAttachment() as Attachment | null)?.spec === true); }
  private sendSpectators(events: GameEvent[]) {
    const specs = this.spectators(); if (!specs.length || !this.core) return;
    for (const m of this.core.spectatorMessages(events)) { const s = JSON.stringify(m); for (const ws of specs) { try { ws.send(s); } catch { /* */ } } }
  }
  private socketsOf(pid: string) { return this.ctx.getWebSockets().filter((w) => (w.deserializeAttachment() as Attachment | null)?.pid === pid); }

  private async schedule() {
    const now = Date.now();
    let at = this.core?.nextAlarm() ?? null;
    const pending = this.ctx.getWebSockets().some((w) => { const a = w.deserializeAttachment() as Attachment | null; return !a?.pid && !a?.spec; });
    if (pending) at = Math.min(at ?? Infinity, now + UNAUTH_MS + 500);
    if (at === null) await this.ctx.storage.deleteAlarm(); else await this.ctx.storage.setAlarm(Math.max(at, now + 50));
  }

  private async apply(out: Outbox) {
    for (const { to, msg } of out.send) { const s = JSON.stringify(msg satisfies ServerMessage); for (const ws of this.socketsOf(to)) { try { ws.send(s); } catch { /* socket chiuso */ } } }
    for (const c of out.close) for (const ws of this.socketsOf(c.playerId)) { try { ws.close(c.code, c.reason); } catch { /* già chiuso */ } }
    if (out.destroy) {
      for (const ws of this.ctx.getWebSockets()) { try { ws.send(JSON.stringify({ t: "closed", reason: "room-closed" })); ws.close(1000, "room-closed"); } catch { /* */ } }
      await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); this.core = null; return;
    }
    if (out.persist || out.events) this.sendSpectators(out.events ?? []);
    if (out.persist) this.save();
    await this.schedule();
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/create" && request.method === "POST") {
      if (this.core) return json({ error: "EXISTS" }, 409);
      const body = createRoomBody.safeParse(await request.json().catch(() => null));
      const code = request.headers.get("x-room-code");
      if (!body.success || !code) return json({ error: "INVALID_REQUEST" }, 400);
      const { core, playerId, token } = RoomCore.create(code, this.deps(), Date.now(), body.data);
      this.core = core; this.save(); await this.schedule();
      return json({ code, playerId, token } satisfies SessionResponse);
    }
    if (!this.core) return json({ error: "NOT_FOUND" }, 404);
    if (url.pathname === "/info" && request.method === "GET") return json(this.core.publicInfo());
    if (url.pathname === "/join" && request.method === "POST") {
      const body = joinRoomBody.safeParse(await request.json().catch(() => null));
      if (!body.success) return json({ error: "INVALID_REQUEST" }, 400);
      try {
        const r = this.core.join(body.data.nickname, Date.now(), body.data.char);
        await this.apply(r.out);
        return json({ code: this.core.data.code, playerId: r.playerId, token: r.token } satisfies SessionResponse);
      } catch (e) { if (e instanceof RoomError) return json({ error: e.code, message: e.message }, e.code === "ROOM_FULL" || e.code === "NICKNAME_TAKEN" || e.code === "GAME_STARTED" ? 409 : 400); throw e; }
    }
    if (url.pathname === "/ws" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair(); const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server); server.serializeAttachment({ pid: null, at: Date.now() } satisfies Attachment);
      await this.schedule();
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ error: "NOT_FOUND" }, 404);
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const now = Date.now(), att = (ws.deserializeAttachment() as Attachment | null) ?? { pid: null, at: now };
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) { ws.close(1009, "message too big"); return; }
    if (!this.core) { ws.close(4004, "room-closed"); return; }
    let raw: unknown; try { raw = JSON.parse(message); } catch { ws.close(4400, "invalid json"); return; }
    const parsed = clientMessageSchema.safeParse(raw);
    if (!att.pid && parsed.success && parsed.data.t === "watch") { // schermo condiviso: sola visione
      if (!this.core.data.options.display) { ws.send(JSON.stringify({ t: "error", code: "DISPLAY_OFF", message: "schermo condiviso non abilitato" })); ws.close(4003, "display off"); return; }
      ws.serializeAttachment({ pid: null, at: now, spec: true } satisfies Attachment);
      for (const m of this.core.spectatorMessages()) ws.send(JSON.stringify(m)); return;
    }
    if (att.spec) { ws.close(4401, "read only"); return; } // gli schermi condivisi non inviano comandi
    if (!att.pid) { // primo messaggio: autenticazione
      if (!parsed.success || parsed.data.t !== "hello") { ws.close(4401, "hello required"); return; }
      const pid = this.core.authenticate(parsed.data.token);
      if (!pid) { ws.send(JSON.stringify({ t: "error", code: "BAD_TOKEN", message: "sessione non valida" })); ws.close(4001, "bad token"); return; }
      for (const old of this.socketsOf(pid)) { try { old.send(JSON.stringify({ t: "closed", reason: "replaced" })); old.close(4002, "replaced"); } catch { /* */ } }
      ws.serializeAttachment({ pid, at: now } satisfies Attachment);
      await this.apply(this.core.onConnect(pid, now)); return;
    }
    const pid = att.pid;
    let bucket = this.buckets.get(pid); if (!bucket) { bucket = new TokenBucket(30, 15, now); this.buckets.set(pid, bucket); }
    if (!bucket.take(now)) { const s = (this.strikes.get(pid) ?? 0) + 1; this.strikes.set(pid, s); ws.send(JSON.stringify({ t: "error", code: "RATE_LIMIT", message: "troppi messaggi" })); if (s > 20) ws.close(4008, "rate limit"); return; }
    if (!parsed.success) {
      const s = (this.strikes.get(pid) ?? 0) + 1; this.strikes.set(pid, s);
      ws.send(JSON.stringify({ t: "error", code: "INVALID_MESSAGE", message: "messaggio non valido" })); if (s > 10) ws.close(4400, "too many invalid messages"); return;
    }
    await this.apply(this.core.handle(pid, parsed.data, now));
  }

  override async webSocketClose(ws: WebSocket) { await this.dropped(ws); }
  override async webSocketError(ws: WebSocket) { await this.dropped(ws); }
  private async dropped(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    try { ws.close(); } catch { /* */ }
    if (!att?.pid || !this.core) return;
    if (this.socketsOf(att.pid).some((w) => w !== ws)) return; // c'è già una connessione più recente
    await this.apply(this.core.onDisconnect(att.pid, Date.now()));
  }

  override async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment() as Attachment | null; if (!a?.pid && !a?.spec && now - a!.at > UNAUTH_MS) { try { ws.close(4401, "hello timeout"); } catch { /* */ } } }
    if (!this.core) return;
    await this.apply(this.core.tick(now));
  }
}
