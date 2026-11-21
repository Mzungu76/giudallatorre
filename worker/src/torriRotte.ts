import { nomiNoti } from "@gdt/game-protocol";
import { DECK, EXPANSIONS } from "./content.ts";
import { KeyedLimiter, cryptoBytes } from "./security.ts";
import { nuovoId } from "./TowerPoll.ts";
import type { TorriEnv } from "./TowerPoll.ts";
import catalogo from "../../public/espansioni/catalogo.json";

const h = { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: h });
const creaLimit = new KeyedLimiter(8, 3600_000), votoLimit = new KeyedLimiter(40, 60_000), viewLimit = new KeyedLimiter(120, 60_000);

/** Carte ammesse (base + espansioni in vendita) e nomi noti dei personaggi (non vanno segnalati come «nomi di persona»). */
const CARTE = [...DECK, ...Object.values(EXPANSIONS).flatMap((e) => e.cards)];
const NOMI = [...new Set((catalogo.mazzi as { nomi?: string[] }[]).flatMap((m) => m.nomi ?? []))];
const hex = (n: number) => [...cryptoBytes(n)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function leggi(req: Request, max: number): Promise<unknown | null> { const t = await req.text(); if (t.length > max) return null; try { return JSON.parse(t); } catch { return null; } }
const stub = (env: TorriEnv, id: string) => env.TORRI.get(env.TORRI.idFromName(id));
const inoltra = (env: TorriEnv, id: string, op: string, init?: RequestInit) => stub(env, id).fetch(`https://torre/${op}`, init);

/** `/api/torri…`: crea, guarda, vota, nickname, annulla, chiudi, segnala, immagine social. Restituisce null se la rotta non è questa. */
export async function rotteTorri(req: Request, env: TorriEnv, path: string, ip: string, now: number): Promise<Response | null> {
  if (path === "/api/torri" && req.method === "POST") {
    if (!creaLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
    const b = await leggi(req, 6000) as { carte?: unknown } | null; if (!b || typeof b !== "object") return reply({ error: "INVALID_REQUEST" }, 400);
    const id = nuovoId(), admin = hex(16);
    const res = await inoltra(env, id, "create", { method: "POST", body: JSON.stringify({ id, admin, creazione: b, ctx: { nomi: nomiNoti(NOMI).size ? [...nomiNoti(NOMI)] : [], carte: CARTE } }) });
    const out = await res.json() as Record<string, unknown>; return reply(res.ok ? { id, admin, ...out } : out, res.status);
  }
  const m = path.match(/^\/api\/torri\/([a-z0-9]{8})(?:\/(view|vote|nick|cancel|close|report|og))?$/);
  if (!m) return null;
  const id = m[1]!, op = m[2] ?? "view";
  if (op === "view" || (op === "og" && req.method === "GET")) { if (!viewLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429); const u = new URL(req.url); return inoltra(env, id, `${op}?d=${encodeURIComponent(u.searchParams.get("d") ?? "")}&a=${encodeURIComponent(u.searchParams.get("a") ?? "")}`); }
  if (req.method !== "POST") return reply({ error: "INVALID_REQUEST" }, 405);
  if (!votoLimit.allow(ip, now)) return reply({ error: "RATE_LIMIT" }, 429);
  const body = await leggi(req, op === "og" ? 340_000 : 1500); if (!body) return reply({ error: "INVALID_REQUEST" }, 400);
  return inoltra(env, id, op, { method: "POST", body: JSON.stringify(body) });
}

/** `/t/<id>`: la pagina dell'app con i meta tag per le anteprime dei social (titolo-domanda, età, immagine; per 18+ senza la frase). */
export async function paginaTorre(req: Request, env: TorriEnv & { ASSETS: Fetcher }, id: string, now: number): Promise<Response> {
  const origin = new URL(req.url).origin, page = await env.ASSETS.fetch(new Request(`${origin}/`));
  let v: { stato?: string; eta?: number; frase?: string; verbo?: string; hasOg?: boolean; chiude?: number } = {};
  try { const r = await inoltra(env, id, "view"); if (r.ok) v = await r.json() as typeof v; } catch { /* torre inesistente: pagina normale */ }
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const aperta = v.stato === "aperta" || v.stato === "chiusa", eta = v.eta ?? 6;
  const titolo = aperta ? `Chi butteresti giù dalla torre?${eta >= 10 ? ` · ${eta}+` : ""}` : "Giù dalla Torre";
  const desc = !aperta ? "Una torre da votare su Giù dalla Torre." : eta >= 18 ? "Torre 18+ · tocca per aprire e votare." : `Oggi ${v.verbo ?? "sale"} sulla torre… ${v.frase ?? ""}`;
  const img = aperta && v.hasOg && eta < 99 ? `${origin}/t/${id}/og.jpg` : `${origin}/icons/icon-512.png`;
  const meta = `<meta name="robots" content="noindex"><meta property="og:type" content="website"><meta property="og:title" content="${esc(titolo)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${origin}/t/${id}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(titolo)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">`;
  const html = (await page.text()).replace(/<title>[^<]*<\/title>/, `<title>${esc(titolo)}</title>${meta}`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
}
export async function immagineTorre(env: TorriEnv, id: string): Promise<Response> {
  const r = await inoltra(env, id, "og"); if (!r.ok) return new Response("not found", { status: 404 });
  const out = new Response(r.body, r); return out;
}
