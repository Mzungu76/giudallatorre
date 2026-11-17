import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";
import type { StereoGame } from "./stereo.ts";

const hash = (t: string): number => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const ha = (k: string): boolean => ts(k as TestoKey) !== k;   // il testo esiste?

export interface RigaCl { id: string; score: number }
/** La battuta accanto a un nome: dipende dal posto (primo, secondo, a metà, ultimo, zero punti) e varia da persona a persona. */
export function battutaRiga(rows: RigaCl[], i: number, vincitori: Set<string>): string {
  const r = rows[i]!, cat = vincitori.has(r.id) ? "primo" : r.score === 0 ? "zero" : i === rows.length - 1 ? "ultimo" : i === 1 ? "secondo" : "centro";
  return ts(`rp.q.${cat}.${hash(r.id) % 4}` as TestoKey);
}
/** Il titolo sopra la classifica: chi ha vinto (uno solo, o a pari merito). */
export function titoloVincitori(nomi: string[], seme: string): string {
  if (nomi.length > 1) return ts("rp.titolo.pari", { nomi: nomi.join(", ") });
  return ts(`rp.titolo.${hash(seme) % 5}` as TestoKey, { nome: nomi[0] ?? "" });
}
/** Il ruolo di un luogo comune «politico → bugiardo» (null per gli aspetti «@…»). */
export const ruoloDelLuogo = (k: string): string | null => { const r = k.split(" → ")[0] ?? ""; return r && !r.startsWith("@") ? r : null; };
export interface Premio { ruolo: string; carta: string | null; titolo: string; riga: string }
/** I badge (premi) dei primi luoghi comuni: il ruolo, la carta più votata di quel ruolo e le due righe di testo. */
export function premi(g: StereoGame, max = 3): Premio[] {
  const out: Premio[] = [];
  for (const x of g.top) {
    const r = ruoloDelLuogo(x.k); if (!r || !ha(`rp.b.${r}.t`)) continue;
    const carta = x.det ? Object.entries(x.det.c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
    out.push({ ruolo: r, carta, titolo: ts(`rp.b.${r}.t` as TestoKey), riga: ts(`rp.b.${r}.s` as TestoKey) });
    if (out.length >= max) break;
  }
  return out;
}
/** Le carte da mostrare nel riquadro del luogo comune: le più votate dietro i primi luoghi comuni. */
export function carteLuoghi(g: StereoGame, max = 4): string[] {
  const conta: Record<string, number> = {};
  for (const x of g.top) for (const [id, n] of Object.entries(x.det?.c ?? {})) conta[id] = (conta[id] ?? 0) + n;
  return Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, max).map(([id]) => id);
}
export const commentoLancio = (cardId: string): string => ts(`rp.lan.${hash(cardId) % 4}` as TestoKey);
export const rigaGauge = (fascia: number): string => ts(`rp.gs.${fascia}` as TestoKey);
export const testimone = (ruolo: string): string => ts(`dt.q.${ruolo}` as TestoKey);
export const chiusaAggravante = (seme: string): string => ts(`dt.agg.${hash(seme) % 4}` as TestoKey);
