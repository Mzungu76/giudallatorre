import type { GameState } from "@gdt/game-engine";

export interface StereoRow { id: string; n: number; s: number; pct: number }
/** Le righe del pannello «Luoghi comuni»: per giocatore, voti contati, voti per luogo comune e percentuale; dal più al meno; + quanto sarebbe stato per caso (media). */
export function stereoRows(st: GameState["stereo"] | null | undefined, ids: readonly string[]): { rows: StereoRow[]; caso: number | null } {
  if (!st || !st.turni) return { rows: [], caso: null };
  const rows = ids.filter((id) => (st.n[id] ?? 0) > 0).map((id) => ({ id, n: st.n[id]!, s: st.s[id] ?? 0, pct: Math.round(((st.s[id] ?? 0) / st.n[id]!) * 100) })).sort((a, b) => b.pct - a.pct || b.n - a.n);
  return { rows, caso: Math.round((st.c / st.turni) * 100) };
}
