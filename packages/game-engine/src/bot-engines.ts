import * as production from "./ai.ts";
import * as baseline from "./ai-baseline/ai.ts";
import * as v2 from "./ai-v2/ai.ts";

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
  "v2": {
    id: "v2", label: "Bot v2 (sperimentale)",
    description: "Copia dei bot attuali con due leve accese (TUNE.markBoost = 1,5, TUNE.adaptFollow = 1); con le leve a 0 decide come i bot attuali. Collegato solo alle stanze di collaudo (?motore=v2).",
    chooseAction: v2.chooseBotAction as never, planMiniVote: v2.planMiniVote as never, newMemory: v2.newBotMemory as never, learn: v2.learnFromResult as never, tune: v2.TUNE,
  },
  "v2m": {
    id: "v2m", label: "Bot v2 + etichette morbide (sperimentale)",
    description: "Come i bot nuovi in produzione (v2 + etichette v2) ma con l'affinità «morbida»: conta le etichette imparentate e deduce con prudenza le etichette delle frasi libere. Collaudo: ?motore=v2m.",
    chooseAction: v2.chooseBotActionSmooth as never, planMiniVote: v2.planMiniVote as never, newMemory: v2.newBotMemory as never, learn: v2.learnFromResult as never, tune: v2.TUNE,
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
