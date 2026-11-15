import * as production from "./ai.ts";
import * as baseline from "./ai-baseline/ai.ts";

/**
 * Registro dei motori dei bot. Ogni versione ha un identificativo, così il simulatore e l'AI Laboratory possono farle giocare l'una contro l'altra.
 * Regola (docs/AI_ARCHITECTURE.md): una nuova versione diventa quella predefinita (`DEFAULT_BOT_ENGINE`) solo dopo aver superato test di regressione e benchmark.
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
    description: "Bot originali (tag Git baseline-ai-v1, commit 6e2f4b1), copia congelata. Valuta il NON CADE come +1 invece di +2 (scelta storica, vedi TUNE.noncadeEv).",
    chooseAction: baseline.chooseBotAction, planMiniVote: baseline.planMiniVote, newMemory: baseline.newBotMemory, learn: baseline.learnFromResult, tune: baseline.TUNE,
  },
  "legacy-1.1": {
    id: "legacy-1.1", label: "Bot attuali (legacy 1.1)",
    description: "Bot in produzione: decisioni identiche alla baseline (verificato da test), ma il punteggio ipotetico passa da scoreTurn del motore (unica fonte delle regole). Il peso storico del NON CADE è il parametro esplicito TUNE.noncadeEv = 0.5.",
    chooseAction: production.chooseBotAction, planMiniVote: production.planMiniVote, newMemory: production.newBotMemory, learn: production.learnFromResult, tune: production.TUNE,
  },
};
/** Motore usato in partita finché una versione nuova non supera i benchmark. */
export const DEFAULT_BOT_ENGINE = "legacy-1.1";
export const getBotEngine = (id: string | undefined): BotEngine => BOT_ENGINES[id ?? DEFAULT_BOT_ENGINE] ?? BOT_ENGINES[DEFAULT_BOT_ENGINE]!;
