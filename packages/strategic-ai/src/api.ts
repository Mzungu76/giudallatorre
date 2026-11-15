import type { Action, BotLevel, BotStyle, Observation, PlayerId } from "@gdt/game-engine";

/**
 * Interfaccia dei motori strategici (Strategic AI Engine).
 *
 * REGOLA DI CONFINE: un motore riceve solo un `Observation` (ciò che un giocatore seduto al tavolo può sapere) e mai lo stato completo della partita.
 * Per questo `src/` di questo pacchetto importa da `@gdt/game-engine` solo nomi di una lista consentita (niente stato di gioco, `applyAction`,
 * `createGame`, `viewFor`): lo controlla `tests/boundary.test.ts`.
 * Per simulare il futuro un motore usa la propria copia ipotetica della partita costruita dall'osservazione (Fase 5), non quella vera.
 */
export interface DecisionContext {
  /** Generatore casuale dell'esterno (il motore non ha Math.random: partite ripetibili con lo stesso seme). */
  rand: () => number;
  level: BotLevel;
  style: BotStyle;
  /** Tempo massimo per decidere, in ms. Il motore deve rispondere (anche con la migliore azione trovata finora) entro questo limite. */
  budgetMs?: number;
}

export interface StrategicEngine<Memory = unknown> {
  /** Identificativo stabile della versione (compare nei risultati e in docs/AI_CHANGELOG.md). */
  id: string;
  label: string;
  /** Memoria del motore per una partita (o più, se non azzerata). Serializzabile. */
  newMemory(): Memory;
  /** Aggiorna la memoria alla fine di un turno, con l'osservazione dei risultati (fase RESULTS). */
  learn(memory: Memory, obs: Observation): void;
  /** L'azione scelta oppure null se `me` non deve agire ora. Deve essere una delle `legalActions(obs)`. */
  decide(memory: Memory, obs: Observation, ctx: DecisionContext): Action | null;
}

export type { Action, Observation, PlayerId };
