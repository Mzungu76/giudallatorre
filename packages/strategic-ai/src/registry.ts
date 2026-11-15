import type { StrategicEngine } from "./api.ts";
import { randomLegal } from "./engines/randomLegal.ts";

/** Motori strategici disponibili. Nessuno è collegato alle stanze: il Worker usa ancora solo i bot di `ai.ts` (DEFAULT_BOT_ENGINE). */
export const STRATEGIC_ENGINES: Record<string, StrategicEngine<never>> = {
  [randomLegal.id]: randomLegal as StrategicEngine<never>,
};
export const getStrategicEngine = (id: string): StrategicEngine<never> | undefined => STRATEGIC_ENGINES[id];
