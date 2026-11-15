import type { GameRow } from "./match.ts";
import { byEngine, byLevel, byParticipant, byPlayers, bySeat, byStyle, summarize } from "./tournament.ts";
import type { Summary, TournamentResult } from "./tournament.ts";

/** Una cella CSV: virgolette solo se serve (virgola, virgolette, a capo); i numeri non finiti restano vuoti. */
export const csvCell = (v: string | number | boolean): string => {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: (string | number | boolean)[]) => cells.map(csvCell).join(",");

export const GAMES_HEADER = ["game", "seed", "players", "turns", "golden", "seat", "participant", "engine", "level", "style", "score", "place", "winShare", "margin", "decisions", "ms", "maxMs"];
/** Un record per posto e partita (formato «lungo»: comodo per fogli di calcolo e pandas). */
export function gamesCsv(games: readonly GameRow[]): string {
  const rows = [line(GAMES_HEADER)];
  for (const g of games) for (const s of g.seats) rows.push(line([g.game, g.seed, g.players, g.turns, g.golden, s.seat, s.participant, s.engine, s.level, s.style, s.score, s.place, s.winShare, s.margin, s.decisions, Math.round(s.ms * 1000) / 1000, Math.round(s.maxMs * 1000) / 1000]));
  return rows.join("\n") + "\n";
}

export const SUMMARY_HEADER = ["group", "key", "games", "winRate", "winRateLo", "winRateHi", "avgScore", "avgScoreLo", "avgScoreHi", "avgPlace", "avgPlaceLo", "avgPlaceHi", "margin", "marginLo", "marginHi", "msPerDecision", "maxMs"];
export interface SummaryTables { participant: Summary[]; engine: Summary[]; level: Summary[]; style: Summary[]; players: Summary[]; seat: Summary[] }
export function summaryTables(games: readonly GameRow[]): SummaryTables {
  return { participant: summarize(games, byParticipant), engine: summarize(games, byEngine), level: summarize(games, byLevel), style: summarize(games, byStyle), players: summarize(games, byPlayers), seat: summarize(games, bySeat) };
}
export function summaryCsv(t: SummaryTables): string {
  const rows = [line(SUMMARY_HEADER)];
  for (const [group, list] of Object.entries(t) as [string, Summary[]][]) for (const s of list)
    rows.push(line([group, s.key, s.games, s.winRate.mean, s.winRate.lo, s.winRate.hi, s.avgScore.mean, s.avgScore.lo, s.avgScore.hi, s.avgPlace.mean, s.avgPlace.lo, s.avgPlace.hi, s.margin.mean, s.margin.lo, s.margin.hi, s.msPerDecision, s.maxMs]));
  return rows.join("\n") + "\n";
}

/** JSON completo: configurazione (per ripetere l'esperimento), versioni, riepiloghi e partite. */
export function resultsJson(r: TournamentResult): string {
  return JSON.stringify({ lab: r.lab, resultsHash: r.resultsHash, config: r.config, engines: r.engines, summary: summaryTables(r.games), games: r.games }, null, 1);
}

const pct = (x: number) => (100 * x).toFixed(1) + "%";
/** Tabella leggibile per il terminale. */
export function formatReport(r: TournamentResult): string {
  const t = summaryTables(r.games), out: string[] = [];
  out.push(`${r.config.name ?? "torneo"} — ${r.games.length} partite, ${r.config.players} giocatori, seme ${r.config.seed}, lab ${r.lab}, impronta ${r.resultsHash}`);
  const head = ["partecipante", "partite", "vittorie (IC95%)", "punti (IC95%)", "posizione", "margine", "ms/decisione"];
  const rows = t.participant.map((s) => [s.key, String(s.games), `${pct(s.winRate.mean)} ±${(100 * s.winRate.half).toFixed(1)}`, `${s.avgScore.mean.toFixed(2)} ±${s.avgScore.half.toFixed(2)}`, `${s.avgPlace.mean.toFixed(2)} ±${s.avgPlace.half.toFixed(2)}`, `${s.margin.mean.toFixed(2)} ±${s.margin.half.toFixed(2)}`, s.msPerDecision.toFixed(2)]);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((x) => x[i]!.length)));
  out.push(head.map((h, i) => h.padEnd(w[i]!)).join("  "), ...rows.map((x) => x.map((c, i) => c.padEnd(w[i]!)).join("  ")));
  const bad = r.games.filter((g) => g.problems.length);
  if (bad.length) out.push(`ATTENZIONE: ${bad.length} partite con problemi (es. partita ${bad[0]!.game}: ${bad[0]!.problems[0]})`);
  return out.join("\n");
}
