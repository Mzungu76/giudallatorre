import { applyAction, createGame, planMiniVote, MINI_COUNTDOWN_MS, MINI_INTRO_MS, MINI_SLOT_MS, newBotMemory, suggestAction } from "@gdt/game-engine";
import type { Action, BotLevel, GameState, MiniKind } from "@gdt/game-engine";

/**
 * Simulatore degli intervalli: il motore vero (stessa logica del server), senza stanza né giocatori.
 * I bot votano ai tempi pianificati come in RoomCore; l'unico «giocatore» è `SIM_ME`. Funzioni pure: si provano con i test.
 */
export const SIM_ME = "p1";
export type SimStart = "inizio" | "conto" | "corsa" | "verdetto" | "punti";
export type SimVotes = "caso" | "presto" | "forzato" | "nessuno";
export interface SimOpts {
  kind: MiniKind; players: number; start: SimStart; votes: SimVotes;
  /** Carte che i bot votano nei modi «presto» e «forzato» (a pari merito: più carte). Vuoto = scelta casuale. */
  forced: number[];
  /** Il giocatore vota da solo (in automatico) come i bot, invece di premere «QUESTO!». */
  autoMe: boolean; level: BotLevel; seed: number;
}
export interface SimRun { state: GameState; goAt: number; endAt: number; plan: Record<string, { at: number; position: number }>; log: { who: string; position: number; at: number }[] }

export const SIM_NAMES = ["Tu", "Bot Gino", "Bot Mara", "Bot Pino", "Bot Lella", "Bot Tito"];
const ACCUSE = ["Mi ha rubato il panino al prosciutto!", "Ha spoilerato il finale della serie!", "Mi ha lasciato in visualizzato per tre giorni!", "Ha mangiato l'ultima fetta di torta!", "Si è seduto sul mio posto!"];
const PHRASES = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, phrases: ["a", "b", "c", "d", "e"].map((x) => `frase ${i}${x}`) }));
const lcg = (seed: number) => { let r = (seed >>> 0) % 2147483647 || 7; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; };

/** Le posizioni in cui compare una carta nell'ordine di uscita. */
export const slotsOf = (order: number[], position: number) => order.map((p, i) => (p === position ? i : -1)).filter((i) => i >= 0);

/** Un voto vale se arriva mentre la carta è in scena (stesso margine del server: 0,3 s prima, 0,7 s dopo). */
export function onStage(run: Pick<SimRun, "goAt" | "state">, position: number, now: number, early = 300, late = 700): boolean {
  const order = run.state.mini?.order ?? [];
  return order.some((p, i) => { if (p !== position) return false; const t = run.goAt + i * MINI_SLOT_MS; return now >= t - early && now <= t + MINI_SLOT_MS + late; });
}

/** Porta una partita finta fino all'inizio dell'intervallo e pianifica i voti. `cardIds`: le carte da usare (almeno ~60). */
export function newSim(o: SimOpts, cardIds: string[], now: number): SimRun {
  const rand = lcg(o.seed), n = Math.max(3, Math.min(6, o.players));
  let s = createGame({
    players: SIM_NAMES.slice(0, n).map((name, i) => ({ id: `p${i + 1}`, name })), seed: o.seed | 0, deck: cardIds, phraseDeck: PHRASES, accuseDeck: ACCUSE,
    miniGame: o.kind, cnc: true, megafonoSa: true, firstMegafonoIndex: 0,
  }).state;
  for (let g = 0; s.phase !== "MINI_RUN" && g < 4000; g++) {
    if (s.phase === "RESULTS") { s = applyAction(s, { type: "advance" }).state; continue; }
    for (const p of s.playerIds) { const a = suggestAction(s, p, rand); if (a) { s = applyAction(s, a).state; break; } }
  }
  if (s.phase !== "MINI_RUN") throw new Error("l'intervallo non è partito");
  const order = s.mini!.order;
  const goAt = o.start === "inizio" ? now + MINI_INTRO_MS + MINI_COUNTDOWN_MS : o.start === "conto" ? now + MINI_COUNTDOWN_MS : o.start === "corsa" ? now + 400 : now - 1;
  const run: SimRun = { state: s, goAt, endAt: goAt + order.length * MINI_SLOT_MS + 900, plan: {}, log: [] };
  // i voti dei bot (e, in automatico, anche del giocatore)
  if (o.votes !== "nessuno") {
    const mem = newBotMemory(), voters = s.playerIds.filter((p) => p !== SIM_ME || o.autoMe), single = o.forced.length ? o.forced : [1 + Math.floor(rand() * 6)];
    voters.forEach((id, i) => {
      let position: number;
      if (o.votes === "caso") {   // come in partita: il bot guarda le carte man mano che escono e preme dopo il suo tempo di reazione
        const pl = planMiniVote(s, id, o.level, mem, rand); if (!pl) return;
        run.plan[id] = { position: pl.position, at: goAt + pl.slot * MINI_SLOT_MS + pl.delayMs }; return;
      }
      if (o.votes === "forzato") position = o.forced.length ? o.forced[i % o.forced.length]! : 1 + Math.floor(rand() * 6);
      else if (o.votes === "presto") position = single[i % single.length]!;
      else position = 1;
      const sl = slotsOf(order, position), k = o.votes === "presto" ? sl[0]! : sl[Math.floor(rand() * sl.length)]!;
      run.plan[id] = { position, at: o.votes === "presto" ? goAt + k * MINI_SLOT_MS + 400 + Math.floor(rand() * 1600) : goAt + k * MINI_SLOT_MS + 500 + Math.floor(rand() * 1900) };
    });
  }
  // partenza «dal verdetto» / «dai punti»: tutto è già successo
  if (o.start === "verdetto" || o.start === "punti") {
    let st = run.state;
    for (const [id, v] of Object.entries(run.plan).sort((a, b) => a[1].at - b[1].at)) { if (st.phase !== "MINI_RUN") break; st = applyAction(st, { type: "vote", playerId: id, position: v.position } as Action).state; run.log.push({ who: id, position: v.position, at: v.at }); }
    if (st.phase === "MINI_RUN") st = applyAction(st, { type: "endRun" }).state;
    return { ...run, state: st, plan: {} };
  }
  return run;
}

/** Un passo di tempo: i bot votano quando è il loro momento e, a fine corsa, si contano i voti. Restituisce lo stesso oggetto se nulla è cambiato. */
export function stepSim(run: SimRun, now: number): SimRun {
  if (run.state.phase !== "MINI_RUN") return run;
  const due = Object.entries(run.plan).filter(([, v]) => now >= v.at).sort((a, b) => a[1].at - b[1].at);
  let st = run.state; const plan = { ...run.plan }, log = run.log.slice();
  for (const [id, v] of due) { if (st.phase !== "MINI_RUN") break; delete plan[id]; try { st = applyAction(st, { type: "vote", playerId: id, position: v.position }).state; log.push({ who: id, position: v.position, at: now }); } catch { /* già votato */ } }
  if (st.phase === "MINI_RUN" && now >= run.endAt) st = applyAction(st, { type: "endRun" }).state;
  return st === run.state && !due.length ? run : { ...run, state: st, plan, log };
}

/** Il giocatore preme «QUESTO!»: stesso controllo del server. Restituisce null se il voto non vale. */
export function humanVote(run: SimRun, position: number, now: number): SimRun | null {
  const st = run.state;
  if (st.phase !== "MINI_RUN" || st.votes[SIM_ME] !== undefined || !onStage(run, position, now)) return null;
  const nx = applyAction(st, { type: "vote", playerId: SIM_ME, position }).state, plan = { ...run.plan }; delete plan[SIM_ME];
  return { ...run, state: nx, plan, log: [...run.log, { who: SIM_ME, position, at: now }] };
}

/** Opzioni predefinite e lettura/scrittura dal collegamento (così un link riproduce lo stesso scenario). */
export const SIM_DEFAULTS: SimOpts = { kind: "accusa", players: 4, start: "inizio", votes: "caso", forced: [2], autoMe: false, level: "medium", seed: 1 };
export function optsFromQuery(q: URLSearchParams): SimOpts {
  const kinds: MiniKind[] = ["accusa", "amore", "peggiore"], starts: SimStart[] = ["inizio", "conto", "corsa", "verdetto", "punti"], votes: SimVotes[] = ["caso", "presto", "forzato", "nessuno"];
  const pick = <T,>(v: string | null, all: T[], d: T) => (all as unknown as string[]).includes(v ?? "") ? (v as unknown as T) : d;
  const forced = (q.get("e") ?? "").split(",").map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 6);
  return {
    kind: pick(q.get("k"), kinds, SIM_DEFAULTS.kind), start: pick(q.get("p"), starts, SIM_DEFAULTS.start), votes: pick(q.get("v"), votes, SIM_DEFAULTS.votes),
    players: Math.max(3, Math.min(6, Number(q.get("n")) || SIM_DEFAULTS.players)), forced: q.has("e") ? forced : SIM_DEFAULTS.forced, autoMe: q.get("a") === "1",
    level: pick(q.get("l"), ["easy", "medium", "hard"] as BotLevel[], SIM_DEFAULTS.level), seed: Number(q.get("seed")) || 0,
  };
}
export function optsToQuery(o: SimOpts, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ k: o.kind, p: o.start, n: String(o.players), v: o.votes, e: o.forced.join(","), a: o.autoMe ? "1" : "0", l: o.level, ...extra });
  if (o.seed) q.set("seed", String(o.seed));
  return q.toString();
}
