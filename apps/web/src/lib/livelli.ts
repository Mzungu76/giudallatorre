import type { Totals } from "./stats.ts";

/**
 * Livelli del giocatore (50). Si calcolano dai contatori delle statistiche (nel dispositivo): nessun dato in più da salvare,
 * e chi ha già giocato trova subito il suo livello. Esperienza (XP) = somma dei punti qui sotto; la soglia di ogni livello cresce
 * con la potenza 1,5 (i primi livelli arrivano presto, gli ultimi chiedono sempre di più). Titoli in `public/testi.json` (chiavi `lv.N`).
 */
export const MAX_LEVEL = 50;

/** XP per ogni cosa che si fa. */
export const XP = { game: 25, podium: 15, win: 25, point: 1, vote: 1, voteHit: 4, mega: 6, tokenHit: 10, mini: 5, miniHit: 10, miniFast: 15 } as const;

export function xpOf(t: Totals): number {
  return t.games * XP.game + t.podiums * XP.podium + t.wins * XP.win + t.points * XP.point + t.votes * XP.vote + t.voteHits * XP.voteHit + t.megaTurns * XP.mega
    + (t.cadeHit + t.noncadeHit + t.nulliHit) * XP.tokenHit + t.minis * XP.mini + t.miniHits * XP.miniHit + t.miniFast * XP.miniFast;
}

/** XP totali necessari per raggiungere il livello `n` (1 = 0). */
export const xpFor = (n: number): number => (n <= 1 ? 0 : Math.round((40 * (n - 1) ** 1.5) / 10) * 10);

/** Un'icona disegnata per ogni livello (nomi in `components/GameIcon.tsx`): dalle fondamenta alla leggenda della Torre. */
export const ICONS: readonly string[] = [
  "passante", "curioso", "spettatore", "sassolino", "mattone", "muratore", "secchio", "impalcatura", "scala", "porta",
  "chiave", "campanello", "ascensore", "finestra", "balcone", "pettegolo", "carte", "urna", "spillo", "palazzo",
  "vertigini", "bersaglio", "fiuto", "maschere", "castello", "megafono", "pedina", "caduta", "scudo", "divieto",
  "arco", "sfera", "cervello", "fulmine", "torre", "ciak", "paracadute", "equilibrista", "nuvola", "terrazza",
  "aquila", "maestro", "cilindro", "occhio", "coppa", "stella", "tempesta", "corona", "drago", "leggenda",
];
/** Cinque fasce da dieci livelli, ognuna col suo colore. */
export const TIER_COLORS = ["#c98f5a", "#14a3a1", "#5b7cfa", "#e8505b", "#ffc72c"] as const;
export const tierOf = (n: number): number => Math.min(4, Math.floor((n - 1) / 10));

export interface LevelInfo { level: number; xp: number; from: number; to: number | null; progress: number; toNext: number }
export function levelFor(xp: number): LevelInfo {
  let level = 1; while (level < MAX_LEVEL && xp >= xpFor(level + 1)) level++;
  const from = xpFor(level), to = level >= MAX_LEVEL ? null : xpFor(level + 1);
  return { level, xp, from, to, progress: to === null ? 1 : (xp - from) / (to - from), toNext: to === null ? 0 : to - xp };
}
