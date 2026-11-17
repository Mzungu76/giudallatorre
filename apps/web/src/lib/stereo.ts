import type { GameState } from "@gdt/game-engine";

export interface StereoGame { pct: number; caso: number; n: number; top: { k: string; n: number; pct: number }[]; lancio: { cardId: string; ruolo: string; n: number; text: string } | null }
/** Il pannello «Luoghi comuni» è della PARTITA, non dei giocatori: quanta parte dei voti di tutti si spiega con un luogo comune, quanto sarebbe stato per caso e quali luoghi comuni hanno pesato di più. */
export function stereoGame(st: GameState["stereo"] | null | undefined, max = 3): StereoGame | null {
  if (!st || !st.turni) return null;
  const n = Object.values(st.n).reduce((a, b) => a + b, 0); if (!n) return null;
  const s = Object.values(st.s).reduce((a, b) => a + b, 0), pesi = Object.values(st.cause ?? {}).reduce((a, b) => a + b, 0);   // percentuale = quota del peso totale dei luoghi comuni emersi
  const top = Object.entries(st.cause ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k, v]) => ({ k, n: v, pct: pesi > 0 ? Math.round((v / pesi) * 100) : 0 }));
  const L = st.lancio;
  return { pct: Math.round((s / n) * 100), caso: Math.round((st.c / st.turni) * 100), n, top, lancio: L ? { cardId: L.cardId, ruolo: ruoloDi(L.causa), n: L.n, text: L.text } : null };
}

/** «politico → bugiardo» → «Politico». */
export const ruoloDi = (causa: string): string => { const r = causa.split(" → ")[0] ?? causa; return r.charAt(0).toUpperCase() + r.slice(1); };
/** Umani contro bot: quota dei voti «per luogo comune» di ciascun gruppo (null se il gruppo non ha votato). */
export function stereoGruppi(st: GameState["stereo"] | null | undefined, isBot: (id: string) => boolean): { umani: number | null; bot: number | null } {
  const acc = { u: [0, 0], b: [0, 0] };
  for (const [id, n] of Object.entries(st?.n ?? {})) { const g = isBot(id) ? acc.b : acc.u; g[0]! += st?.s[id] ?? 0; g[1]! += n; }
  const q = (g: number[]) => (g[1] ? Math.round((g[0]! / g[1]!) * 100) : null);
  return { umani: q(acc.u), bot: q(acc.b) };
}

/** Le fasce del pregiudiziometro: ogni voto è già un giudizio a occhio, quindi il tachimetro parte da circa il 35% e le fasce stanno nella parte alta. */
export const SEG_PREGIUDIZIO = [{ a: 0, b: 0.5, c: "#4aa63a" }, { a: 0.5, b: 0.65, c: "#f4c20d" }, { a: 0.65, b: 0.8, c: "#f08a1c" }, { a: 0.8, b: 1, c: "#e5382b" }] as const;
export const fasciaPregiudizio = (pct: number): 0 | 1 | 2 | 3 => (pct < 50 ? 0 : pct < 65 ? 1 : pct < 80 ? 2 : 3);
