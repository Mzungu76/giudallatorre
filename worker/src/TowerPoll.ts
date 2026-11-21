import { DurableObject } from "cloudflare:workers";
import { TorreErrore, annulla, chiudiPrima, chiusuraEffettiva, creaTorre, nickname, scadenzaDati, segnala, statoDi, vista, vota } from "./torriCore.ts";
import type { Contesto, Creazione, TorreData } from "./torriCore.ts";
import { cryptoBytes } from "./security.ts";

export interface TorriEnv { TORRI: DurableObjectNamespace<TowerPoll> }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
export const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const STATUS: Record<string, number> = { NON_TROVATA: 404, CHIUSA: 409, GIA_VOTATO: 409, PIENA: 429, NON_AUTORE: 403, TARDI: 409 };

/**
 * Una torre degli utenti = un Durable Object (SQLite). Tiene i dati in una riga JSON; la chiusura e la cancellazione sono allarmi.
 * Rotte interne (le inoltra `index.ts`): create, view, vote, nick, cancel, close, report, og.
 */
export class TowerPoll extends DurableObject<TorriEnv> {
  private d: TorreData | null = null;
  constructor(ctx: DurableObjectState, env: TorriEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
      const row = ctx.storage.sql.exec("SELECT v FROM kv WHERE k = 'torre'").toArray()[0]; if (row) this.d = JSON.parse(row.v as string) as TorreData;
    });
  }
  private save() { if (this.d) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('torre', ?)", JSON.stringify(this.d)); }
  private async riarma() {
    if (!this.d) return; const now = Date.now(), st = statoDi(this.d, now);
    const quando = st === "aperta" ? chiusuraEffettiva(this.d) : this.d.annullata ? now + 1000 : scadenzaDati(this.d);
    await this.ctx.storage.setAlarm(Math.max(quando, now + 1000));
  }
  override async alarm() {
    if (!this.d) return; const now = Date.now();
    if (now >= (this.d.annullata ? now : scadenzaDati(this.d)) || (this.d.elimina && now >= this.d.elimina)) { await this.ctx.storage.deleteAll(); this.d = null; return; }
    await this.riarma();
  }
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url), op = url.pathname.slice(1), now = Date.now();
    try {
      if (op === "create") {
        if (this.d) return json({ error: "ESISTE" }, 409);
        const b = await request.json() as { id: string; admin: string; creazione: Creazione; ctx: { nomi: string[]; carte: string[] } };
        const nomi = new Set(b.ctx.nomi), carte = new Set(b.ctx.carte), ctx: Contesto = { cartaValida: (x) => carte.has(x), nomi };
        this.d = creaTorre(b.creazione, ctx, b.id, await sha(b.admin), now); this.save(); await this.riarma();
        return json({ ok: true, chiude: this.d.chiude, eta: this.d.eta });
      }
      if (!this.d) return json({ error: "NON_TROVATA" }, 404);
      const d = this.d, b = (request.method === "POST" ? await request.json().catch(() => ({})) : {}) as Record<string, unknown>;
      const dv = String(b.dev ?? url.searchParams.get("d") ?? ""), dev = dv.length >= 8 ? await sha(dv) : undefined;
      const ad = String(b.admin ?? url.searchParams.get("a") ?? ""), adm = ad.length >= 16 ? (await sha(ad)) === d.adminHash : false;
      if (op === "view") return json(vista(d, now, dev, adm));
      if (op === "og") {
        if (request.method === "GET") { if (!d.og || statoDi(d, now) === "annullata" || statoDi(d, now) === "nascosta") return new Response("not found", { status: 404 }); const bin = Uint8Array.from(atob(d.og), (c) => c.charCodeAt(0)); return new Response(bin, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=600" } }); }
        if (!adm) throw new TorreErrore("NON_AUTORE"); const img = String(b.img ?? ""); if (!/^[A-Za-z0-9+/=]+$/.test(img) || img.length > 330_000) throw new TorreErrore("NON_AMMESSO"); d.og = img; this.save(); return json({ ok: true });
      }
      if (op === "vote") { if (!dev) throw new TorreErrore("VOTO"); if (adm) throw new TorreErrore("NON_AMMESSO"); vota(d, dev, Number(b.pos), now); this.save(); return json({ ok: true }); }
      if (op === "nick") { if (!dev) throw new TorreErrore("VOTO"); const n = nickname(d, dev, String(b.nick ?? "")); this.save(); return json({ ok: true, nick: n }); }
      if (op === "cancel") { annulla(d, adm, now); this.save(); await this.riarma(); return json({ ok: true }); }
      if (op === "close") { chiudiPrima(d, adm, String(b.motivo ?? ""), String(b.conferma ?? ""), now); this.save(); await this.riarma(); return json({ ok: true }); }
      if (op === "report") { if (!dev) throw new TorreErrore("VOTO"); segnala(d, dev); this.save(); return json({ ok: true }); }
      return json({ error: "NON_TROVATA" }, 404);
    } catch (e) {
      if (e instanceof TorreErrore) return json({ error: e.codice }, STATUS[e.codice] ?? 400);
      throw e;
    }
  }
}
export function nuovoId(): string { const A = "abcdefghjkmnpqrstuvwxyz23456789"; let o = ""; while (o.length < 8) for (const b of cryptoBytes(16)) if (b < 248 && o.length < 8) o += A[b % A.length]; return o; }
