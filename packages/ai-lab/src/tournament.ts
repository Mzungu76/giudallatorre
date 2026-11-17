import { BOT_ENGINES } from "@gdt/game-engine";
import { specKey } from "./agents.ts";
import type { AgentSpec } from "./agents.ts";
import { playGame } from "./match.ts";
import type { GameRow, LabContent, PlayOptions } from "./match.ts";
import { hashString, meanCI, pairedDiff } from "./stats.ts";
import type { MeanCI } from "./stats.ts";
import nextRandomMod from "./rng.ts";

export const LAB_VERSION = "0.1";

/**
 * Configurazione di un torneo (serializzabile in JSON: è ciò che si salva per ripetere l'esperimento).
 * - `lineup: "fixed"`: `participants` ha tanti elementi quanti `players`; ogni partita li rimescola sui posti (con il seme).
 * - `lineup: "pool"`: a ogni partita si estraggono `players` partecipanti dal gruppo `participants` (senza ripetizioni).
 */
export interface TournamentConfig {
  name?: string; games: number; players: number; seed: number;
  participants: AgentSpec[]; lineup?: "fixed" | "pool";
  miniGame?: "random" | false;
  /** Parametri di taratura per versione, applicati solo durante il torneo: { "baseline-1": { "tempHard": 1.5 } }. */
  tune?: Record<string, Record<string, number>>;
}

export interface TournamentResult {
  lab: string; config: TournamentConfig; /** Versioni dei motori usate e parametri effettivi. */ engines: Record<string, { label: string; tune: Record<string, number> }>;
  games: GameRow[]; /** Impronta dei risultati ripetibili (esclude i tempi): due esecuzioni uguali danno la stessa. */ resultsHash: string;
}

/** Posti di una partita: estrazione e rimescolamento deterministici dal seme. */
export function lineupFor(cfg: TournamentConfig, seed: number): AgentSpec[] {
  const rand = nextRandomMod(seed ^ 0x27d4eb2f), pool = cfg.participants.slice(), out: AgentSpec[] = [];
  const lineup = cfg.lineup ?? "fixed";
  if (lineup === "fixed" && pool.length !== cfg.players) throw new Error(`lineup "fixed": servono esattamente ${cfg.players} partecipanti, ce ne sono ${pool.length}`);
  if (lineup === "pool" && pool.length < cfg.players) throw new Error(`lineup "pool": il gruppo (${pool.length}) è più piccolo dei giocatori (${cfg.players})`);
  while (out.length < cfg.players) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  return out;
}

export function validateConfig(cfg: TournamentConfig): void {
  if (!Number.isInteger(cfg.games) || cfg.games < 1) throw new Error("games deve essere un intero ≥ 1");
  if (!Number.isInteger(cfg.players) || cfg.players < 3 || cfg.players > 8) throw new Error("players deve essere tra 3 e 8");
  if (!cfg.participants?.length) throw new Error("servono dei partecipanti");
  for (const p of cfg.participants) if (!BOT_ENGINES[p.engine]) throw new Error(`motore sconosciuto: ${p.engine}`);
  lineupFor(cfg, cfg.seed);
}

/** Dati ripetibili di una partita (senza i tempi), per l'impronta. */
const stable = (g: GameRow) => ({ game: g.game, seed: g.seed, players: g.players, turns: g.turns, golden: g.golden, problems: g.problems, seats: g.seats.map((s) => [s.seat, s.participant, s.level, s.style, s.score, s.place, s.winShare, s.decisions]) });

export interface RunOptions extends PlayOptions {
  onGame?: (row: GameRow, done: number, total: number) => void;
  /** Se restituisce true il torneo si ferma dopo la partita corrente (risultati parziali). */
  shouldStop?: () => boolean;
}

/** Esegue il torneo. I parametri `tune` vengono applicati ai motori e RIPRISTINATI alla fine (anche se si verifica un errore). */
export function runTournament(cfg: TournamentConfig, content: LabContent, opts: RunOptions = {}): TournamentResult {
  validateConfig(cfg);
  const saved: Record<string, Record<string, number>> = {}, games: GameRow[] = [];
  try {
    for (const [eng, params] of Object.entries(cfg.tune ?? {})) {
      const e = BOT_ENGINES[eng]; if (!e) throw new Error(`tune: motore legacy sconosciuto ${eng}`);
      saved[eng] ??= {};
      for (const [k, v] of Object.entries(params)) { if (!(k in e.tune)) throw new Error(`tune: parametro sconosciuto ${eng}.${k}`); saved[eng]![k] = e.tune[k]!; e.tune[k] = v; }
    }
    for (let g = 0; g < cfg.games; g++) {
      const seed = (cfg.seed + g * 7919) | 0, seats = lineupFor(cfg, seed);
      const row = playGame(seats, g, seed, content, { ...(cfg.miniGame !== undefined ? { miniGame: cfg.miniGame } : {}), ...(opts.strict !== undefined ? { strict: opts.strict } : {}), ...(opts.onResults ? { onResults: opts.onResults } : {}) });
      games.push(row); opts.onGame?.(row, g + 1, cfg.games);
      if (opts.shouldStop?.()) break;
    }
    const engines: TournamentResult["engines"] = {};
    for (const p of cfg.participants) { const e = BOT_ENGINES[p.engine]; engines[p.engine] = { label: e?.label ?? p.engine, tune: e ? { ...e.tune } : {} }; }
    return { lab: LAB_VERSION, config: cfg, engines, games, resultsHash: hashString(JSON.stringify(games.map(stable))) };
  } finally {
    for (const [eng, params] of Object.entries(saved)) for (const [k, v] of Object.entries(params)) BOT_ENGINES[eng]!.tune[k] = v;
  }
}

// ---------- aggregazione ----------
export interface Summary {
  key: string; games: number;
  winRate: MeanCI; avgScore: MeanCI; avgPlace: MeanCI; margin: MeanCI;
  decisions: number; msPerDecision: number; maxMs: number;
}
type SeatCtx = { row: GameRow; s: GameRow["seats"][number] };
const flat = (games: readonly GameRow[]): SeatCtx[] => games.flatMap((row) => row.seats.map((s) => ({ row, s })));

/** Riepilogo per chiave (partecipante, livello, motore, carattere, numero di giocatori…). Le vittorie sono quote per partita (parità divise). */
export function summarize(games: readonly GameRow[], keyOf: (c: SeatCtx) => string = (c) => c.s.participant): Summary[] {
  const by = new Map<string, SeatCtx[]>();
  for (const c of flat(games)) { const k = keyOf(c); (by.get(k) ?? by.set(k, []).get(k)!).push(c); }
  return [...by.entries()].map(([key, cs]) => ({
    key, games: cs.length,
    winRate: meanCI(cs.map((c) => c.s.winShare)), avgScore: meanCI(cs.map((c) => c.s.score)), avgPlace: meanCI(cs.map((c) => c.s.place)), margin: meanCI(cs.map((c) => c.s.margin)),
    decisions: cs.reduce((a, c) => a + c.s.decisions, 0), msPerDecision: cs.reduce((a, c) => a + c.s.ms, 0) / Math.max(1, cs.reduce((a, c) => a + c.s.decisions, 0)), maxMs: Math.max(...cs.map((c) => c.s.maxMs)),
  })).sort((a, b) => a.key.localeCompare(b.key));
}

export const byParticipant = (c: SeatCtx) => c.s.participant;
export const byLevel = (c: SeatCtx) => c.s.level;
export const byEngine = (c: SeatCtx) => c.s.engine;
export const byStyle = (c: SeatCtx) => c.s.style;
export const byPlayers = (c: SeatCtx) => `${c.row.players} giocatori`;
export const bySeat = (c: SeatCtx) => `posto ${c.s.seat}`;

/**
 * Confronto appaiato tra due gruppi di partecipanti nelle STESSE partite (stesso tavolo e stesso seme): per ogni partita, media del gruppo A meno media del gruppo B.
 * `isA`/`isB` scelgono i posti. Restituisce le differenze di punteggio, di quota vittorie e di posizione (negativa = A migliore) con IC 95%.
 */
export function compareGroups(games: readonly GameRow[], isA: (s: GameRow["seats"][number]) => boolean, isB: (s: GameRow["seats"][number]) => boolean) {
  const sa: number[] = [], sb: number[] = [], wa: number[] = [], wb: number[] = [], pa: number[] = [], pb: number[] = [];
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const g of games) {
    const A = g.seats.filter(isA), B = g.seats.filter((s) => isB(s) && !isA(s));
    if (!A.length || !B.length) continue;
    sa.push(avg(A.map((s) => s.score))); sb.push(avg(B.map((s) => s.score)));
    wa.push(avg(A.map((s) => s.winShare))); wb.push(avg(B.map((s) => s.winShare)));
    pa.push(avg(A.map((s) => s.place))); pb.push(avg(B.map((s) => s.place)));
  }
  return { games: sa.length, score: pairedDiff(sa, sb), winRate: pairedDiff(wa, wb), place: pairedDiff(pa, pb) };
}
