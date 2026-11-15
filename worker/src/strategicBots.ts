import { legalActions, observe } from "@gdt/game-engine";
import type { Action, BotLevel, BotStyle, GameState } from "@gdt/game-engine";
import { STRATEGIC_ENGINES } from "@gdt/strategic-ai";

/**
 * Giocatori virtuali con il motore strategico SPERIMENTALE (Strategic AI Engine, vedi docs/AI_ARCHITECTURE.md).
 * Si attivano solo in una stanza di collaudo creata da `/crea?debug=bot&motore=strategico` (opzione `botEngine: "strategic"`, valida solo con `debug`);
 * senza quell'opzione questo file non viene mai chiamato e i bot sono quelli di sempre (`chooseBotAction`).
 * Decidono solo dall'osservazione del giocatore (mai dallo stato completo). L'intervallo a tempo resta ai bot attuali (`planMiniVote`).
 * Per tornare indietro: docs/AI_ROLLBACK.md.
 */
/** Interruttore di spegnimento: con `false` l'opzione `botEngine` viene ignorata alla creazione della stanza e i bot sono sempre quelli di sempre. */
export const STRATEGIC_BOTS_ENABLED = true;
export const STRATEGIC_BOT_ENGINE = "strategic-pts-0.1";
/** Tempo massimo (ms) per le simulazioni di una decisione. */
export const STRATEGIC_BUDGET_MS = 8;

/** Memoria dei bot strategici per identificativo (serializzabile: sopravvive al riavvio del Durable Object). */
export type StrategicMem = Record<string, unknown>;

export const botHasMove = (g: GameState, id: string): boolean => legalActions(observe(g, id)).length > 0;

export function botMove(g: GameState, id: string, mem: StrategicMem, level: BotLevel, rand: () => number, style: BotStyle): Action | null {
  const eng = STRATEGIC_ENGINES[STRATEGIC_BOT_ENGINE]!; mem[id] ??= eng.newMemory();
  return eng.decide(mem[id] as never, observe(g, id), { rand, level, style, budgetMs: STRATEGIC_BUDGET_MS });
}

/** A fine turno (fase RESULTS) ogni bot impara dai risultati rivelati. */
export function botLearn(g: GameState, botIds: readonly string[], mem: StrategicMem): void {
  const eng = STRATEGIC_ENGINES[STRATEGIC_BOT_ENGINE]!;
  for (const id of botIds) { mem[id] ??= eng.newMemory(); eng.learn(mem[id] as never, observe(g, id)); }
}
