import { applyAction, checkInvariants, createGame, EngineError, nextRandom } from "@gdt/game-engine";
import type { Action, GameState, PhraseCard } from "@gdt/game-engine";
import { makeAgent, resolveStyles, specKey } from "./agents.ts";
import type { AgentSpec, Agent, LegacyShared } from "./agents.ts";

/** Contenuti per giocare: mazzo personaggi, mazzo frasi (uno per partita, dal seme) e accuse dell'intervallo. */
export interface LabContent { deck: string[]; phraseDeck: (seed: number) => PhraseCard[]; accuseDeck: string[] }

export interface SeatResult {
  seat: number; participant: string; engine: string; level: string; style: string;
  score: number; /** 1 = primo; i pari merito condividono il posto. */ place: number; /** 1/n_vincitori se ha vinto (parità divise), altrimenti 0. */ winShare: number;
  /** Vantaggio sul punteggio medio degli altri. */ margin: number;
  decisions: number; /** Tempo totale di decisione (ms): misura di prestazione, non fa parte del risultato ripetibile. */ ms: number; maxMs: number;
}
export interface GameRow { game: number; seed: number; players: number; turns: number; golden: boolean; problems: string[]; seats: SeatResult[] }

export interface PlayOptions {
  /** Intervallo (mini-gioco) a metà partita: "random" (come in gioco) o false. */ miniGame?: "random" | false;
  /** true (default): un'azione illegale o una partita bloccata lanciano un errore; false: la partita finisce segnata con un problema. */ strict?: boolean;
}

const stream = (seed: number) => { let r = seed | 0; return () => { const x = nextRandom(r); r = x.state; return x.value; }; };

/**
 * Gioca UNA partita completa. Le mosse sono davvero simultanee: a ogni passo tutti i giocatori decidono dallo STESSO stato (nessuno vede l'azione di chi
 * ha deciso prima) e poi le azioni si applicano in ordine casuale (deciso dal seme; conta nel solo caso del più veloce dell'intervallo).
 * Tutta la casualità deriva da `seed`: stessi partecipanti, posti e seme → stessa partita.
 */
export function playGame(seats: readonly AgentSpec[], game: number, seed: number, content: LabContent, opts: PlayOptions = {}): GameRow {
  const n = seats.length, strict = opts.strict ?? true, botRand = stream(seed ^ 0x9e3779b9), orderRand = stream(seed ^ 0x85ebca6b), styleRand = stream(seed ^ 0xc2b2ae35);
  const styles = resolveStyles(seats, styleRand), shared = new Map<string, LegacyShared>();
  const agents: Agent[] = seats.map((s, i) => makeAgent(s, styles[i]!, shared));
  const players = seats.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })), ids = players.map((p) => p.id);
  const deck = content.deck;
  let s: GameState = createGame({ players, seed, deck, phraseDeck: content.phraseDeck(seed), miniGame: opts.miniGame ?? "random", accuseDeck: content.accuseDeck }).state;
  const decisions = new Array<number>(n).fill(0), ms = new Array<number>(n).fill(0), maxMs = new Array<number>(n).fill(0), problems: string[] = [];
  let guard = 0;
  while (s.phase !== "GAME_OVER") {
    if (++guard > 8000) { if (strict) throw new Error(`partita ${game} (seme ${seed}) non termina`); problems.push("non termina"); break; }
    if (s.phase === "RESULTS") { agents.forEach((a, i) => a.learn(s, ids[i]!)); s = applyAction(s, { type: "advance" }).state; continue; }
    if (s.phase === "MINI_RESULTS") { s = applyAction(s, { type: "advance" }).state; continue; }
    const snapshot = s, acts: { i: number; a: Action }[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now(), a = agents[i]!.decide(snapshot, ids[i]!, botRand), dt = performance.now() - t0;
      if (a) { acts.push({ i, a }); decisions[i]!++; ms[i]! += dt; maxMs[i] = Math.max(maxMs[i]!, dt); }
    }
    if (acts.length === 0) {
      if (s.phase === "MINI_RUN") { s = applyAction(s, { type: "endRun" }).state; continue; }
      if (strict) throw new Error(`partita ${game} (seme ${seed}): nessuna azione in fase ${s.phase}`);
      problems.push(`bloccata in ${s.phase}`); break;
    }
    // ordine di applicazione casuale (Fisher–Yates con il generatore dell'ordine)
    for (let k = acts.length - 1; k > 0; k--) { const j = Math.floor(orderRand() * (k + 1)); [acts[k], acts[j]] = [acts[j]!, acts[k]!]; }
    for (const { i, a } of acts) {
      try { s = applyAction(s, a).state; }
      catch (e) {
        if (!(e instanceof EngineError)) throw e;
        const msg = `${agents[i]!.key} (posto ${i + 1}) azione illegale in ${s.phase}: ${e.message}`;
        if (strict) throw new Error(`partita ${game} (seme ${seed}): ${msg}`);
        problems.push(msg);
      }
    }
  }
  problems.push(...checkInvariants(s, deck));
  const scores = ids.map((p) => s.scores[p]!), top = Math.max(...scores), winners = scores.filter((x) => x === top).length;
  const rows: SeatResult[] = seats.map((spec, i) => {
    const sc = scores[i]!, others = scores.filter((_, j) => j !== i), place = 1 + scores.filter((x) => x > sc).length;
    return { seat: i + 1, participant: specKey(spec), engine: spec.engine, level: agents[i]!.level, style: agents[i]!.styleId, score: sc, place, winShare: sc === top ? 1 / winners : 0,
      margin: sc - others.reduce((a, b) => a + b, 0) / Math.max(1, others.length), decisions: decisions[i]!, ms: ms[i]!, maxMs: maxMs[i]! };
  });
  return { game, seed, players: n, turns: s.turnNumber, golden: s.goldenGoal, problems, seats: rows };
}
