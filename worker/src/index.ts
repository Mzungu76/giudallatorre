import { createRoomBody, joinRoomBody, roomCodeSchema, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@gdt/game-protocol";
import { GameRoom } from "./GameRoom.ts";
import type { Env } from "./GameRoom.ts";
import { KeyedLimiter, cryptoBytes } from "./security.ts";

export { GameRoom };

const headers = { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
// Limiti per IP (in memoria dell'isolate: protezione di base, vedi docs/SECURITY.md per le regole Cloudflare gratuite)
const createLimit = new KeyedLimiter(10, 60_000), joinLimit = new KeyedLimiter(30, 60_000), infoLimit = new KeyedLimiter(60, 60_000);

function newCode(): string {
  let out = ""; const n = ROOM_CODE_ALPHABET.length, max = 256 - (256 % n);
  while (out.length < ROOM_CODE_LENGTH) for (const b of cryptoBytes(8)) if (b < max && out.length < ROOM_CODE_LENGTH) out += ROOM_CODE_ALPHABET[b % n];
  return out;
}
const stub = (env: Env, code: string) => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
async function readJson(req: Request): Promise<unknown | null> {
  const text = await req.text(); if (text.length > 1024) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await handle(request, env); }
    catch (e) {
      // Un'eccezione non gestita (ad esempio un limite gratuito di Cloudflare esaurito) diventa un errore leggibile e finisce nei log con il suo testo.
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("errore API", new URL(request.url).pathname, msg);
      const detail = msg.slice(0, 200); // solo testo dell'eccezione: aiuta a capire quale limite o guasto è in gioco
      return /exceed|limit|quota|overload/i.test(msg) ? reply({ error: "QUOTA", detail }, 503) : reply({ error: "SERVER", detail }, 500);
    }
  },
};

async function handle(request: Request, env: Env): Promise<Response> {
  {
    const url = new URL(request.url), ip = request.headers.get("cf-connecting-ip") ?? "local", now = Date.now();
    const path = url.pathname;
    if (path === "/api/health") return reply({ ok: true });

    if (path === "/api/rooms" && request.method === "POST") {
      if (!createLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
      const body = createRoomBody.safeParse(await readJson(request));
      if (!body.success) return reply({ error: "INVALID_REQUEST" }, 400);
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const res = await stub(env, code).fetch("https://room/create", { method: "POST", headers: { "x-room-code": code }, body: JSON.stringify(body.data) });
        if (res.status !== 409) return new Response(res.body, { status: res.status, headers });
      }
      return reply({ error: "TRY_AGAIN" }, 503);
    }

    const m = path.match(/^\/api\/rooms\/([^/]+)\/(join|info)$/) ?? path.match(/^\/ws\/([^/]+)$/);
    if (m) {
      const code = roomCodeSchema.safeParse(decodeURIComponent(m[1]!));
      if (!code.success) return reply({ error: "INVALID_CODE" }, 400);
      if (m[2] === "join" && request.method === "POST") {
        if (!joinLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
        const body = joinRoomBody.safeParse(await readJson(request));
        if (!body.success) return reply({ error: "INVALID_REQUEST" }, 400);
        const res = await stub(env, code.data).fetch("https://room/join", { method: "POST", body: JSON.stringify(body.data) });
        return new Response(res.body, { status: res.status, headers });
      }
      if (m[2] === "info" && request.method === "GET") {
        if (!infoLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
        const res = await stub(env, code.data).fetch("https://room/info");
        return res.status === 404 ? reply({ exists: false }) : new Response(res.body, { status: res.status, headers });
      }
      if (path.startsWith("/ws/")) {
        if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return reply({ error: "UPGRADE_REQUIRED" }, 426);
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== url.host) return reply({ error: "FORBIDDEN_ORIGIN" }, 403); // niente WebSocket cross-site
        if (!infoLimit.allow("ws:" + ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
        return stub(env, code.data).fetch("https://room/ws", { headers: request.headers });
      }
    }
    return reply({ error: "NOT_FOUND" }, 404);
  }
}
