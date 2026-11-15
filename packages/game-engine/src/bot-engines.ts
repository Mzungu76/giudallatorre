import * as production from "./ai.ts";
import * as baseline from "./ai-baseline/ai.ts";

/**
 * Registro dei motori dei bot basati sullo stato (`GameState`). Ogni versione ha un identificativo, così il simulatore e l'AI Laboratory possono
 * farle giocare l'una contro l'altra. I motori nuovi (Strategic AI Engine) ricevono invece un `Observation` e stanno in `packages/strategic-ai`.
 * Regola (docs/AI_ARCHITECTURE.md): il motore in produzione (`ai.ts`) NON si tocca; una versione nuova diventa quella predefinita solo dopo benchmark
 * e test di regressione, e solo per decisione esplicita del proprietario.
 */
export interface BotEngine {
  id: string; label: string; description: string;
  chooseAction: typeof production.chooseBotAction;
  planMiniVote: typeof production.planMiniVote;
  newMemory: typeof production.newBotMemory;
  learn: typeof production.learnFromResult;
  /** Parametri di taratura della versione (oggetto vivo, come `TUNE`). */
  tune: Record<string, number>;
}

export const BOT_ENGINES: Record<string, BotEngine> = {
  "baseline-1": {
    id: "baseline-1", label: "Baseline AI v1",
    description: "Bot originali (tag Git baseline-ai-v1, commit 6e2f4b1): copia congelata, con parametri propri.",
    chooseAction: baseline.chooseBotAction, planMiniVote: baseline.planMiniVote, newMemory: baseline.newBotMemory, learn: baseline.learnFromResult, tune: baseline.TUNE,
  },
  "production": {
    id: "production", label: "Bot in produzione (ai.ts)",
    description: "Il codice vivo di ai.ts, identico alla baseline e protetto da un test di impronta. È quello usato nelle stanze.",
    chooseAction: production.chooseBotAction, planMiniVote: production.planMiniVote, newMemory: production.newBotMemory, learn: production.learnFromResult, tune: production.TUNE,
  },
};
/** Motore usato in partita: non cambia senza una decisione esplicita. */
export const DEFAULT_BOT_ENGINE = "production";
export const getBotEngine = (id: string | undefined): BotEngine => BOT_ENGINES[id ?? DEFAULT_BOT_ENGINE] ?? BOT_ENGINES[DEFAULT_BOT_ENGINE]!;
