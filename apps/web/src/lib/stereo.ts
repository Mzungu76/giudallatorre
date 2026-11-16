import type { GameState } from "@gdt/game-engine";

export interface StereoGame { pct: number; caso: number; n: number; top: { k: string; n: number }[] }
/** Il pannello «Luoghi comuni» è della PARTITA, non dei giocatori: quanta parte dei voti di tutti si spiega con un luogo comune, quanto sarebbe stato per caso e quali luoghi comuni hanno pesato di più. */
export function stereoGame(st: GameState["stereo"] | null | undefined, max = 3): StereoGame | null {
  if (!st || !st.turni) return null;
  const n = Object.values(st.n).reduce((a, b) => a + b, 0); if (!n) return null;
  const s = Object.values(st.s).reduce((a, b) => a + b, 0), top = Object.entries(st.cause ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k, v]) => ({ k, n: v }));
  return { pct: Math.round((s / n) * 100), caso: Math.round((st.c / st.turni) * 100), n, top };
}
