import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";

/** Torri degli utenti (docs/TORRI_UTENTE.md): chiamate al server, identità del dispositivo e archivio delle proprie torri. */
export type Eta = 6 | 10 | 14 | 18;
export type Effetto = "cade" | "noncade" | "nulli";
export interface Riga { nick: string; punti: number; ordine: number; tu: boolean }
export interface Risultati { conteggi: number[]; totale: number; percento: number[]; cadono: number[]; segnalinoCaduta: boolean; classifica: Riga[]; effetto: Effetto; posSegnalino: number; votoAutore: number; annullati: number }
export interface VistaTorre {
  id: string; stato: "aperta" | "chiusa" | "annullata" | "nascosta"; eta: Eta; chiude: number; creata: number; carte: string[]; numVoti: number; hasOg: boolean;
  verbo?: "sale" | "salgono"; frase?: string; posSegnalino?: number; mioVoto?: number | null; mioNick?: string | null; autore?: boolean; annullabile?: boolean; chiusaPrima?: boolean; risultati?: Risultati; scadeDati?: number;
}
export interface MiaTorre { id: string; admin: string; creata: number; frase: string }

const LS_DEV = "gdt.dev", LS_MIE = "gdt.torri", LS_ETA = "gdt.etaOk";
function rnd(n: number) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); }
/** Identificativo casuale di questo dispositivo (un voto per dispositivo): resta nel browser, il server ne salva solo l'impronta. */
export function dispositivo(): string { try { let d = localStorage.getItem(LS_DEV); if (!d) { d = rnd(16); localStorage.setItem(LS_DEV, d); } return d; } catch { return rnd(16); } }
export function mie(): MiaTorre[] { try { const x = JSON.parse(localStorage.getItem(LS_MIE) ?? "[]") as MiaTorre[]; return Array.isArray(x) ? x : []; } catch { return []; } }
export function salvaMia(m: MiaTorre) { try { localStorage.setItem(LS_MIE, JSON.stringify([m, ...mie().filter((x) => x.id !== m.id)].slice(0, 30))); } catch { /* memoria piena */ } }
export const adminDi = (id: string) => mie().find((m) => m.id === id)?.admin;
/** Fascia d'età già confermata su questo dispositivo (chi ha dichiarato 18 non deve riconfermare 14). */
export const etaConfermata = (): number => { try { return Number(localStorage.getItem(LS_ETA) ?? 0) || 0; } catch { return 0; } };
export const confermaEta = (e: number) => { try { localStorage.setItem(LS_ETA, String(Math.max(e, etaConfermata()))); } catch { /* niente */ } };

export class TorreApiErr extends Error { constructor(public code: string, public status: number) { super(code); } }
async function call<T>(path: string, body?: unknown): Promise<T> {
  let r: Response;
  try { r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); } catch { throw new TorreApiErr("NETWORK", 0); }
  const j = (await r.json().catch(() => ({}))) as { error?: string } & T; if (!r.ok) throw new TorreApiErr(j.error ?? "SERVER", r.status); return j;
}
export const erroreTorre = (e: unknown) => { const c = e instanceof TorreApiErr ? e.code : "altro"; return ts((TESTI_ERR.includes(c) ? `tu.err.${c}` : "tu.err.altro") as TestoKey); };
const TESTI_ERR = ["CARTE", "CARTA_NON_VALIDA", "FRASE", "FRASE_VIETATA", "FRASE_ETA", "NOME_PERSONA", "SEGNALINO", "VOTO", "DURATA", "NON_TROVATA", "CHIUSA", "GIA_VOTATO", "NICK", "NON_AUTORE", "TARDI", "CONFERMA", "NON_AMMESSO", "RATE_LIMIT", "NETWORK", "PIENA"];

export interface NuovaTorre { carte: string[]; frase: string; eta?: number; personaggioPubblico: boolean; segnalino: { pos: number; effetto: Effetto }; votoAutore: number; durata: "24h" | "3g" | "7g" }
export const creaTorre = (b: NuovaTorre) => call<{ id: string; admin: string; chiude: number; eta: Eta }>("/api/torri", b);
export const vediTorre = (id: string, admin?: string) => call<VistaTorre>(`/api/torri/${id}/view?d=${encodeURIComponent(dispositivo())}${admin ? `&a=${encodeURIComponent(admin)}` : ""}`);
export const votaTorre = (id: string, pos: number) => call<{ ok: true }>(`/api/torri/${id}/vote`, { dev: dispositivo(), pos });
export const nickTorre = (id: string, nick: string) => call<{ ok: true; nick: string }>(`/api/torri/${id}/nick`, { dev: dispositivo(), nick });
export const annullaTorre = (id: string, admin: string) => call<{ ok: true }>(`/api/torri/${id}/cancel`, { admin });
export const chiudiTorre = (id: string, admin: string, motivo: string, conferma: string) => call<{ ok: true }>(`/api/torri/${id}/close`, { admin, motivo, conferma });
export const segnalaTorre = (id: string) => call<{ ok: true }>(`/api/torri/${id}/report`, { dev: dispositivo() });
export const caricaOg = (id: string, admin: string, jpeg: Blob) => new Promise<void>((ok, ko) => { const r = new FileReader(); r.onload = () => { const s = String(r.result), i = s.indexOf(","); call(`/api/torri/${id}/og`, { admin, img: s.slice(i + 1) }).then(() => ok(), ko); }; r.onerror = () => ko(r.error); r.readAsDataURL(jpeg); });
export const linkTorre = (id: string) => `${location.origin}/t/${id}`;

/** «2 g 21 h», «5 h 12 min», «8 min»: tempo mancante. */
export function resta(ms: number): { g: number; h: number; m: number } { const m = Math.max(0, Math.floor(ms / 60_000)); return { g: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60), m: m % 60 }; }
